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

    Pothole clusters are computed on the fly in /api/v1/clusters.
    """
    detections, _clusters_unused = process_trip_payload(payload)

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
