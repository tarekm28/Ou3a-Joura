from typing import Optional, List
from datetime import datetime
import json

import asyncpg
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import API_KEY, DATABASE_URL, MAX_BODY_MB
from .tasks import enqueue_process_trip

app = FastAPI(title="Ou3a Backend API")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

pool: Optional[asyncpg.Pool] = None


class Sample(BaseModel):
    timestamp: str
    uptime_ms: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_m: Optional[float] = None
    speed_mps: Optional[float] = None
    accel: Optional[List[float]] = None
    gyro: Optional[List[float]] = None


class TripPayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    trip_id: str = Field(..., min_length=1)
    start_time: datetime
    end_time: Optional[datetime] = None
    sample_count: Optional[int] = None
    samples: List[Sample]


@app.exception_handler(RateLimitExceeded)
async def ratelimit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"},
    )


@app.on_event("startup")
async def startup():
    global pool
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    pool = await asyncpg.create_pool(dsn=DATABASE_URL)


@app.on_event("shutdown")
async def shutdown():
    global pool
    if pool is not None:
        await pool.close()
        pool = None


@app.get("/api/v1/health")
@limiter.limit("30/minute")
async def health(request: Request):
    return {"ok": True, "time": datetime.utcnow().isoformat() + "Z"}


def _check_api_key(header_value: Optional[str]):
    if not API_KEY:
        # If API_KEY env is empty, effectively disable auth (dev only).
        return
    if header_value != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.post("/api/v1/trips")
@limiter.limit("60/minute")
async def ingest_trip(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    # Enforce API key
    _check_api_key(x_api_key)

    # Basic size check
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            size = int(content_length)
        except ValueError:
            size = 0
        max_bytes = MAX_BODY_MB * 1024 * 1024
        if size > max_bytes:
            raise HTTPException(status_code=413, detail="Payload too large")

    body = await request.json()
    try:
        trip = TripPayload(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    async with pool.acquire() as conn:
        # upsert user
        await conn.execute(
            """
            insert into users (user_id)
            values ($1)
            on conflict (user_id) do nothing
            """,
            trip.user_id,
        )

        # upsert trip metadata
        await conn.execute(
            """
            insert into trips (trip_id, user_id, start_time, end_time, sample_count)
            values ($1, $2, $3, $4, $5)
            on conflict (trip_id) do update
            set user_id = excluded.user_id,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                sample_count = excluded.sample_count,
                created_at = now()
            """,
            trip.trip_id,
            trip.user_id,
            trip.start_time,
            trip.end_time,
            trip.sample_count or len(trip.samples),
        )

        # store raw JSON
        await conn.execute(
            """
            insert into trip_raw (trip_id, payload)
            values ($1, $2)
            on conflict (trip_id) do update
            set payload = excluded.payload,
                created_at = now()
            """,
            trip.trip_id,
            json.dumps(body),
        )

    # Kick off async processing
    enqueue_process_trip(trip.trip_id)

    return {"ok": True}


@app.get("/api/v1/clusters")
@limiter.limit("60/minute")
async def get_clusters(
    request: Request,
    min_conf: float = 0.4,
    since: Optional[datetime] = None,
    limit: int = 500,
):
    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    async with pool.acquire() as conn:
        if since is None:
            # No "since" filter
            rows = await conn.fetch(
                """
                select cluster_id,
                       latitude,
                       longitude,
                       hits,
                       users,
                       last_ts,
                       avg_intensity,
                       exposure,
                       confidence,
                       priority
                from pothole_clusters
                where confidence >= $1
                order by priority desc
                limit $2
                """,
                min_conf,
                limit,
            )
        else:
            # With "since" filter
            rows = await conn.fetch(
                """
                select cluster_id,
                       latitude,
                       longitude,
                       hits,
                       users,
                       last_ts,
                       avg_intensity,
                       exposure,
                       confidence,
                       priority
                from pothole_clusters
                where confidence >= $1
                  and last_ts >= $2
                order by priority desc
                limit $3
                """,
                min_conf,
                since,
                limit,
            )

    return [dict(r) for r in rows]


@app.get("/api/v1/leaderboard")
@limiter.limit("60/minute")
async def leaderboard(request: Request, limit: int = 50):
    if pool is None:
        raise HTTPException(status_code=500, detail="DB pool not initialized")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            select cluster_id,
                   latitude,
                   longitude,
                   hits,
                   users,
                   last_ts,
                   avg_intensity,
                   exposure,
                   confidence,
                   priority
            from pothole_clusters
            order by priority desc
            limit $1
            """,
            limit,
        )

    return [dict(r) for r in rows]
