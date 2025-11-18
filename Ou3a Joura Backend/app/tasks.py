# app/tasks.py

from typing import Any, Dict

import asyncpg

from .processing import process_trip_payload


async def run_trip_processing(
    pool: asyncpg.Pool, trip_id: str, payload: Dict[str, Any]
) -> None:
    """
    Process a single trip and update:
      - detections (raw suspicious spikes)
      - road_quality_segments (rough patches)

    Pothole clusters are computed on the fly in /api/v1/clusters.
    """
    detections, _clusters_unused, segments = process_trip_payload(payload)

    if pool is None:
        return

    async with pool.acquire() as conn:
        async with conn.transaction():
            # --- detections: raw per-event evidence ---
            for d in detections:
                await conn.execute(
                    """
                    INSERT INTO detections (
                        trip_id,
                        ts,
                        latitude,
                        longitude,
                        intensity,
                        stability,
                        mount_state
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    ON CONFLICT (trip_id, ts) DO NOTHING
                    """,
                    trip_id,
                    d["ts"],
                    d.get("lat"),
                    d.get("lon"),
                    d.get("intensity"),
                    d.get("stability"),
                    d.get("mount_state"),
                )

            # --- rough road segments ---
            for s in segments:
                await conn.execute(
                    """
                    INSERT INTO road_quality_segments (
                        segment_id,
                        latitude,
                        longitude,
                        roughness,
                        rough_windows,
                        trips,
                        last_ts,
                        confidence
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,
                        0.0  -- initial confidence, recomputed in UPDATE
                    )
                    ON CONFLICT (segment_id) DO UPDATE
                    SET
                        latitude      = EXCLUDED.latitude,
                        longitude     = EXCLUDED.longitude,
                        roughness     =
                            (road_quality_segments.roughness * road_quality_segments.rough_windows
                             + EXCLUDED.roughness * EXCLUDED.rough_windows)
                            / NULLIF(
                                road_quality_segments.rough_windows + EXCLUDED.rough_windows,
                                0
                            ),
                        rough_windows = road_quality_segments.rough_windows + EXCLUDED.rough_windows,
                        trips         = road_quality_segments.trips + EXCLUDED.trips,
                        last_ts       = GREATEST(
                            road_quality_segments.last_ts,
                            EXCLUDED.last_ts
                        ),
                        confidence    = LEAST(
                            1.0,
                            0.5 * (road_quality_segments.trips + EXCLUDED.trips) / 3.0
                            + 0.5 * (road_quality_segments.rough_windows + EXCLUDED.rough_windows)
                                  / 50.0
                        ),
                        updated_at    = now()
                    """,
                    s["segment_id"],
                    s["lat"],
                    s["lon"],
                    s["roughness"],
                    s["rough_windows"],
                    1,  # one trip contributed
                    s["last_ts"],
                )
