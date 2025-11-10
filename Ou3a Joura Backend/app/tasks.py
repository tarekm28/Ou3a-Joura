import asyncio
import json

import asyncpg
from celery import Celery

from .config import DATABASE_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND
from .processing import process_trip_payload


# Celery app (name "ouaa" matches your worker logs: . ouaa.process_trip)
celery_app = Celery("ouaa", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)


def enqueue_process_trip(trip_id: str) -> None:
    """
    Called by FastAPI after a trip is stored.

    Just enqueue the Celery task by name.
    """
    celery_app.send_task("ouaa.process_trip", args=[trip_id])


@celery_app.task(name="ouaa.process_trip")
def process_trip(trip_id: str):
    """
    Celery entrypoint. Synchronous wrapper around async code.
    """
    asyncio.run(_run(trip_id))


async def _run(trip_id: str):
    """
    1. Load raw JSON payload for this trip from trip_raw.
    2. Run the preprocessing + pothole detection algorithm.
    3. Store detections and aggregate clusters into pothole_clusters.
    """
    if not DATABASE_URL:
        # Misconfiguration – better to fail loudly than silently.
        raise RuntimeError("DATABASE_URL is not set")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        row = await conn.fetchrow(
            "SELECT payload FROM trip_raw WHERE trip_id = $1",
            trip_id,
        )
        if row is None:
            # Nothing to do – maybe trip was deleted.
            return

        payload = row["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)

        detections, clusters = process_trip_payload(payload)

        # ---------- detections ----------
        # Clear previous detections for this trip (idempotent reprocessing)
        await conn.execute(
            "DELETE FROM detections WHERE trip_id = $1",
            trip_id,
        )

        for d in detections:
            await conn.execute(
                """
                INSERT INTO detections (
                    trip_id,
                    ts,
                    latitude,
                    longitude,
                    intensity
                )
                VALUES ($1, $2, $3, $4, $5)
                """,
                trip_id,
                d["ts"],
                d["lat"],
                d["lon"],
                d["intensity"],
            )

        # ---------- clusters ----------
        # Each trip’s clusters are merged into global pothole_clusters.
        for c in clusters:
            await conn.execute(
                """
                INSERT INTO pothole_clusters (
                    cluster_id,
                    latitude,
                    longitude,
                    hits,
                    users,
                    last_ts,
                    avg_intensity,
                    exposure,
                    confidence,
                    priority
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (cluster_id) DO UPDATE
                SET
                    latitude   = EXCLUDED.latitude,
                    longitude  = EXCLUDED.longitude,
                    -- accumulate hits/users across trips
                    hits       = pothole_clusters.hits + EXCLUDED.hits,
                    users      = pothole_clusters.users + EXCLUDED.users,
                    -- keep the most recent sighting timestamp
                    last_ts    = GREATEST(pothole_clusters.last_ts, EXCLUDED.last_ts),
                    -- merge intensity by hit-weighted average
                    avg_intensity =
                        (
                            pothole_clusters.avg_intensity * pothole_clusters.hits
                            + EXCLUDED.avg_intensity * EXCLUDED.hits
                        )
                        / NULLIF(pothole_clusters.hits + EXCLUDED.hits, 0),
                    -- exposure: placeholder add – can be refined later
                    exposure   = pothole_clusters.exposure + EXCLUDED.exposure,
                    -- confidence/priority recomputed by the latest run
                    confidence = EXCLUDED.confidence,
                    priority   = EXCLUDED.priority
                """,
                c["cluster_id"],
                c["lat"],
                c["lon"],
                c["hits"],
                c["users"],
                c["last_ts"],
                c["avg_intensity"],
                c["exposure"],
                c["confidence"],
                c["priority"],
            )
    finally:
        await conn.close()
