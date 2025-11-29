# app/main.py

import json
import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import asyncpg
import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.cluster import DBSCAN

from .config import DATABASE_URL
from .tasks import run_trip_processing

app = FastAPI(title="Ou3a Joura Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pool: Optional[asyncpg.Pool] = None


# ---------------------------------------------------------------------
# Pydantic models matching Android payload
# ---------------------------------------------------------------------


class Sample(BaseModel):
    """
    Matches the Android trip JSON:

    {
      "timestamp": "2025-11-09T10:56:58.962Z",
      "uptime_ms": 378401794,
      "latitude": null,
      "longitude": null,
      "accuracy_m": null,
      "speed_mps": null,
      "accel": [ax, ay, az] or null,
      "gyro": [gx, gy, gz] or null
    }
    """

    timestamp: str
    uptime_ms: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    speed_mps: Optional[float] = None
    accel: Optional[List[float]] = None
    gyro: Optional[List[float]] = None


class TripUpload(BaseModel):
    user_id: str
    trip_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    samples: List[Sample]


# ---------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------


@app.on_event("startup")
async def startup() -> None:
    global pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL env var is required")
    pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10)


@app.on_event("shutdown")
async def shutdown() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


# ---------------------------------------------------------------------
# Basic health
# ---------------------------------------------------------------------


@app.get("/api/v1/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------
# Trip upload
# ---------------------------------------------------------------------


@app.post("/api/v1/trips")
async def upload_trip(
    trip: TripUpload, background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Ingest a trip: store raw payload, basic trip metadata,
    then run processing in the background.
    """
    global pool
    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    payload: Dict[str, Any] = json.loads(trip.json())

    async with pool.acquire() as conn:
        async with conn.transaction():
            # ensure user row exists
            await conn.execute(
                """
                INSERT INTO users (user_id)
                VALUES ($1)
                ON CONFLICT (user_id) DO NOTHING
                """,
                trip.user_id,
            )

            # basic trip metadata
            await conn.execute(
                """
                INSERT INTO trips (
                    trip_id,
                    user_id,
                    start_time,
                    end_time,
                    sample_count
                )
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (trip_id) DO UPDATE
                SET
                    user_id      = EXCLUDED.user_id,
                    start_time   = EXCLUDED.start_time,
                    end_time     = EXCLUDED.end_time,
                    sample_count = EXCLUDED.sample_count
                """,
                trip.trip_id,
                trip.user_id,
                trip.start_time,
                trip.end_time,
                len(trip.samples),
            )

            # raw JSON for offline reprocessing
            await conn.execute(
                """
                INSERT INTO trip_raw (trip_id, payload)
                VALUES ($1,$2)
                ON CONFLICT (trip_id) DO UPDATE
                SET payload = EXCLUDED.payload
                """,
                trip.trip_id,
                json.dumps(payload),
            )

    # detection go to background
    background_tasks.add_task(run_trip_processing, pool, trip.trip_id, payload)

    return {"status": "accepted", "trip_id": trip.trip_id}


# ---------------------------------------------------------------------
# Helper: confidence model for clustered potholes
# ---------------------------------------------------------------------


def _compute_confidence(
    hits: int,
    users: int,
    total_trips: int,
    avg_intensity: float,
    avg_stability: float,
    last_ts: datetime,
    now_utc: datetime,
) -> float:
    """
    Continuous confidence in [0,1], based on:
      - coverage across trips
      - number of hits
      - intensity
      - stability
      - recency
    """
    if total_trips <= 0 or hits <= 0 or users <= 0:
        return 0.0

    # coverage: fraction of trips that saw a bump here at all
    coverage = users / float(total_trips)
    coverage = max(0.0, min(1.0, coverage))

    # hits_term: more hits => higher, saturates
    h0 = 3.0  # ~3 hits already pretty solid
    hits_term = 1.0 - math.exp(-hits / h0)

    # intensity_term: logistic around ~4 z-score
    s0 = 4.0
    intensity_term = 1.0 / (1.0 + math.exp(-(avg_intensity - s0) / 2.0))
    intensity_term = max(0.0, min(1.0, intensity_term))

    # stability_term: 1 = perfectly stable, 0 = chaos
    # avg_stability is [0,1] where 0 = stable, so invert
    stability_quality = 1.0 - max(0.0, min(1.0, avg_stability))

    # recency_term: older blobs slowly fade
    delta_days = (now_utc - last_ts.replace(tzinfo=timezone.utc)).total_seconds() / 86400.0
    decay_days = 60.0  # ~2-month time scale
    if delta_days < 0:
        delta_days = 0.0
    recency_term = math.exp(-delta_days / decay_days)

    confidence_raw = (
        0.45 * coverage
        + 0.25 * hits_term
        + 0.20 * intensity_term
        + 0.10 * stability_quality
    )

    confidence = confidence_raw * recency_term
    return float(max(0.0, min(1.0, confidence)))


# ---------------------------------------------------------------------
# Helper: DBSCAN clustering over detections
# ---------------------------------------------------------------------


def _cluster_potholes_from_df(
    df: pd.DataFrame,
    *,
    total_trips: int,
    eps_m: float,
) -> List[Dict[str, Any]]:
    """
    Cluster detections spatially with DBSCAN + haversine.

    df columns:
      - trip_id
      - user_id
      - ts
      - latitude
      - longitude
      - intensity
      - stability
    """
    if df.empty or total_trips <= 0:
        return []

    # sanity clamp for eps_m
    if not np.isfinite(eps_m) or eps_m <= 0:
        eps_m = 5.0
    eps_m = float(max(2.0, min(eps_m, 30.0)))  # between 2m and 30m

    # clean up timestamps
    df["ts"] = pd.to_datetime(df["ts"], utc=True, errors="coerce")
    df = df.dropna(subset=["ts", "latitude", "longitude"])
    if df.empty:
        return []

    coords_rad = np.radians(df[["latitude", "longitude"]].to_numpy())
    earth_radius_m = 6_371_000.0
    eps_rad = eps_m / earth_radius_m

    clustering = DBSCAN(
        eps=eps_rad,
        min_samples=1,
        metric="haversine",
    ).fit(coords_rad)

    df["cluster_label"] = clustering.labels_
    now_utc = datetime.now(timezone.utc)

    clusters: List[Dict[str, Any]] = []

    for lbl in sorted(df["cluster_label"].unique()):
        group = df[df["cluster_label"] == lbl]
        if group.empty:
            continue

        hits = int(len(group))
        users = int(group["user_id"].nunique())
        if hits <= 0 or users <= 0:
            continue

        lat = float(group["latitude"].mean())
        lon = float(group["longitude"].mean())
        last_ts = group["ts"].max().to_pydatetime()

        avg_intensity = float(group["intensity"].mean())
        avg_stability = float(group["stability"].mean())

        confidence = _compute_confidence(
            hits=hits,
            users=users,
            total_trips=total_trips,
            avg_intensity=avg_intensity,
            avg_stability=avg_stability,
            last_ts=last_ts,
            now_utc=now_utc,
        )

        # Priority: confidence dominates, scaled by intensity and stability
        norm_intensity = min(avg_intensity / 10.0, 1.0)
        priority = float(
            0.7 * confidence
            + 0.3 * norm_intensity * (1.0 - avg_stability)
        )
        priority = max(0.0, min(1.0, priority))

        cid_src = f"{round(lat, 4)}:{round(lon, 4)}"
        cluster_id = "pc_" + hashlib.sha1(cid_src.encode("utf-8")).hexdigest()[:10]

        cluster = {
            "cluster_id": cluster_id,
            "latitude": lat,
            "longitude": lon,
            "hits": hits,
            "users": users,
            "last_ts": last_ts,
            "avg_intensity": avg_intensity,
            "avg_stability": avg_stability,
            "exposure": hits,          # currently evidence-count; can become real exposure later
            "confidence": confidence,
            "priority": priority,
        }

        if confidence >= 0.66:
            cluster["likelihood"] = "very_likely"
        elif confidence >= 0.40:
            cluster["likelihood"] = "likely"
        else:
            cluster["likelihood"] = "uncertain"

        clusters.append(cluster)

    clusters.sort(key=lambda c: (-c["priority"], -c["confidence"]))
    return clusters


# ---------------------------------------------------------------------
# Pothole clusters endpoint (continuous confidence + optional dashboard mode)
# ---------------------------------------------------------------------


@app.get("/api/v1/clusters")
async def get_clusters(
    request: Request,
    min_conf: float = 0.0,
    limit: int = 1000,
    dashboard: bool = False,
    eps_m: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Stage 2 of the pipeline:

      - Stage 1: detections table = per-event suspicious spikes
      - Stage 2: here = DBSCAN spatial clusters across ALL trips,
        using a continuous confidence score.

    Parameters:
      - min_conf: minimum confidence to include (0..1). For debugging.
      - dashboard: if true, we choose a quantile-based threshold from the
                   current confidence distribution instead of trusting
                   min_conf blindly. This is the "government UI" mode.
      - eps_m: DBSCAN neighborhood radius in meters (default 5m). Larger
               merges more nearby detections into a single pothole.
    """
    global pool
    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    async with pool.acquire() as conn:
        # total trips for coverage
        row = await conn.fetchrow("SELECT COUNT(*) AS c FROM trips")
        total_trips = int(row["c"]) if row and row["c"] is not None else 0

        if total_trips == 0:
            return []

        rows = await conn.fetch(
            """
            SELECT
                d.trip_id,
                t.user_id,
                d.ts,
                d.latitude,
                d.longitude,
                d.intensity,
                d.stability,
                d.mount_state
            FROM detections d
            JOIN trips t ON t.trip_id = d.trip_id
            WHERE d.latitude IS NOT NULL
              AND d.longitude IS NOT NULL
              AND d.latitude  BETWEEN -90  AND 90
              AND d.longitude BETWEEN -180 AND 180
            """
        )

    if not rows:
        return []

    df = pd.DataFrame(rows, columns=[
        "trip_id",
        "user_id",
        "ts",
        "latitude",
        "longitude",
        "intensity",
        "stability",
        "mount_state",
    ])

    clusters = _cluster_potholes_from_df(
        df,
        total_trips=total_trips,
        eps_m=eps_m,
    )
    if not clusters:
        return []

    confidences = np.array([c["confidence"] for c in clusters], dtype=float)

    if dashboard:
        if min_conf > 0.0:
            theta = min_conf
        else:
            # quantile-based operating point: show top ~25% most confident
            q = 0.75
            theta = float(np.quantile(confidences, q)) if confidences.size > 0 else 0.0
    else:
        theta = max(0.0, min_conf)

    filtered = [c for c in clusters if c["confidence"] >= theta]

    if limit > 0 and len(filtered) > limit:
        filtered = filtered[:limit]

    return filtered


# ---------------------------------------------------------------------
# Raw detections endpoint (pre-clustering evidence)
# ---------------------------------------------------------------------

@app.get("/api/v1/detections")
async def get_detections(
    min_intensity: float = 0.0,
    min_conf: float = 0.0,   # optional, if you ever add confidence to detections
    limit: int = 5000,
) -> List[Dict[str, Any]]:
    """
    Return raw suspicious detections from ALL trips.
    These are per-event spikes before spatial clustering.
    """
    global pool
    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                trip_id,
                ts,
                latitude,
                longitude,
                intensity,
                stability,
                mount_state
            FROM detections
            WHERE latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND intensity >= $1
            ORDER BY ts DESC
            LIMIT $2
            """,
            min_intensity,
            limit,
        )

    return [dict(r) for r in rows]

