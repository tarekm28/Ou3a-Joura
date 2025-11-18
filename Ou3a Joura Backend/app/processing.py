# app/processing.py

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


def _to_datetime_series(df: pd.DataFrame, payload: Dict[str, Any]) -> pd.Series:
    """
    Build a timezone-aware timestamp column from payload + sample fields.
    Priority:
    - 'timestamp' field in each sample (ISO)  <-- your Android data
    - 'ts' field if already present
    - 't' as ms offset from payload['start_time']
    - fallback: synthetic timestamps (20 Hz)
    """
    if "timestamp" in df.columns:
        return pd.to_datetime(df["timestamp"], utc=True, errors="coerce")

    if "ts" in df.columns:
        return pd.to_datetime(df["ts"], utc=True, errors="coerce")

    start_time = payload.get("start_time")
    if start_time is not None and "t" in df.columns:
        base = pd.to_datetime(start_time, utc=True)
        return base + pd.to_timedelta(df["t"].astype(float), unit="ms")

    # Fallback: assume 20 Hz sampling, synthetic timestamps
    base = pd.Timestamp.utcnow().tz_localize("UTC")
    dt = pd.to_timedelta(1 / 20.0, unit="s")
    return base + df.index.to_series() * dt


def _normalize_columns(df: pd.DataFrame) -> None:
    """
    Convert Android trip format columns to the internal format used by the
    rest of the pipeline.

    Android format:
      - timestamp (ISO)
      - latitude, longitude
      - speed_mps
      - accel: [ax, ay, az]
      - gyro:  [gx, gy, gz]

    Internal format:
      - ts (datetime)
      - lat, lon
      - speed
      - ax, ay, az
      - gx, gy, gz
    """
    # Split accel and gyro arrays into scalar columns if present
    if "accel" in df.columns:
        def _accel_x(v): return float(v[0]) if isinstance(v, (list, tuple)) and len(v) >= 1 else 0.0
        def _accel_y(v): return float(v[1]) if isinstance(v, (list, tuple)) and len(v) >= 2 else 0.0
        def _accel_z(v): return float(v[2]) if isinstance(v, (list, tuple)) and len(v) >= 3 else 0.0

        df["ax"] = df["accel"].apply(_accel_x)
        df["ay"] = df["accel"].apply(_accel_y)
        df["az"] = df["accel"].apply(_accel_z)

    if "gyro" in df.columns:
        def _gyro_x(v): return float(v[0]) if isinstance(v, (list, tuple)) and len(v) >= 1 else 0.0
        def _gyro_y(v): return float(v[1]) if isinstance(v, (list, tuple)) and len(v) >= 2 else 0.0
        def _gyro_z(v): return float(v[2]) if isinstance(v, (list, tuple)) and len(v) >= 3 else 0.0

        df["gx"] = df["gyro"].apply(_gyro_x)
        df["gy"] = df["gyro"].apply(_gyro_y)
        df["gz"] = df["gyro"].apply(_gyro_z)

    # Normalize GPS & speed names
    if "latitude" in df.columns and "lat" not in df.columns:
        df["lat"] = df["latitude"]
    if "longitude" in df.columns and "lon" not in df.columns:
        df["lon"] = df["longitude"]
    if "speed_mps" in df.columns and "speed" not in df.columns:
        df["speed"] = df["speed_mps"]

    # Ensure numeric columns exist
    for col in ("ax", "ay", "az", "gx", "gy", "gz", "speed"):
        if col not in df.columns:
            df[col] = 0.0
    for col in ("lat", "lon"):
        if col not in df.columns:
            df[col] = np.nan


def _compute_stability(df: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
    """
    Compute a simple phone stability score and mount_state from gyro activity.
    stability in [0,1]: 0 = rock solid, 1 = chaos.
    """
    for col in ("gx", "gy", "gz"):
        if col not in df.columns:
            df[col] = 0.0

    g_mag = np.sqrt(df["gx"] ** 2 + df["gy"] ** 2 + df["gz"] ** 2)
    df["g_mag"] = g_mag

    # 1-second windows
    df["window_start"] = df["ts"].dt.floor("1s")
    g_stats = (
        df.groupby("window_start")["g_mag"]
        .agg(["mean", "std"])
        .rename(columns={"mean": "g_mean", "std": "g_std"})
        .fillna(0.0)
    )

    # Map std -> stability [0,1]
    low, high = 0.02, 0.5
    g_stats["stability"] = (g_stats["g_std"] - low) / (high - low)
    g_stats["stability"] = g_stats["stability"].clip(0.0, 1.0)

    # Map stability to mount_state (coarse)
    conds = [
        g_stats["stability"] <= 0.25,
        g_stats["stability"] <= 0.6,
    ]
    choices = ["mounted", "handheld"]
    g_stats["mount_state"] = np.select(conds, choices, default="loose")

    stability_map = g_stats["stability"].to_dict()
    state_map = g_stats["mount_state"].to_dict()

    df["stability"] = df["window_start"].map(stability_map).fillna(1.0)
    df["mount_state"] = df["window_start"].map(state_map).fillna("unknown")

    return df["stability"], df["mount_state"]


def _compute_zscore(df: pd.DataFrame) -> pd.Series:
    """
    Compute a robust z-score for vertical acceleration.
    For now, assume 'az' aligned with gravity-ish.
    """
    if "az" not in df.columns:
        df["az"] = 0.0

    acc = df["az"].astype(float)
    med = acc.median()
    mad = (acc - med).abs().median()

    if mad <= 1e-6:
        z = (acc - med) * 0.0
    else:
        z = 0.6745 * (acc - med) / (mad + 1e-6)

    df["z"] = z.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df["z"]


def _detect_potholes(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Branch A: sharp vertical events = candidate potholes.
    Uses z-score threshold + debouncing + speed + stability.
    """
    detections: List[Dict[str, Any]] = []
    if df.empty:
        return detections

    z_thresh = 5.0      # z-score threshold for a strong bump
    min_speed = 2.0     # m/s ~ 7.2 km/h
    min_gap_s = 0.7     # debounce between events

    last_event_ts = None
    df = df.reset_index(drop=True)

    for idx, row in df.iterrows():
        z = row["z"]
        speed = row.get("speed", np.nan)
        stability = row.get("stability", 1.0)
        ts = row["ts"]

        if z < z_thresh:
            continue
        if not np.isnan(speed) and speed < min_speed:
            continue
        if stability > 0.9:
            continue

        if last_event_ts is not None:
            dt = (ts - last_event_ts).total_seconds()
            if dt < min_gap_s:
                continue

        # Local peak refinement (±5 samples)
        start = max(0, idx - 5)
        end = min(len(df), idx + 6)
        window = df.iloc[start:end]
        peak_idx = window["z"].idxmax()
        peak_row = df.loc[peak_idx]

        intensity = float(abs(peak_row["z"]))
        lat = float(peak_row.get("lat", np.nan))
        lon = float(peak_row.get("lon", np.nan))
        speed_p = float(peak_row.get("speed", np.nan))
        stability_p = float(peak_row.get("stability", 1.0))
        mount_state = str(peak_row.get("mount_state", "unknown"))

        intensity_norm = np.tanh(intensity / 6.0)
        stability_weight = 1.0 - stability_p
        stability_weight = float(np.clip(stability_weight, 0.0, 1.0))
        if np.isnan(speed_p):
            speed_weight = 0.7
        else:
            speed_weight = float(np.clip(speed_p / 15.0, 0.3, 1.0))

        confidence = float(
            np.clip(intensity_norm * stability_weight * speed_weight, 0.0, 1.0)
        )

        detections.append(
            {
                "ts": peak_row["ts"].to_pydatetime(),
                "lat": lat,
                "lon": lon,
                "intensity": intensity,
                "stability": stability_p,
                "mount_state": mount_state,
                "confidence": confidence,
            }
        )

        last_event_ts = peak_row["ts"]

    return detections


def _cluster_potholes_for_trip(
    detections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Trip-level clustering: group detections into ~10m cells.
    Aggregation across trips happens in the DB.
    """
    if not detections:
        return []

    df = pd.DataFrame(detections)
    df = df.dropna(subset=["lat", "lon"])
    if df.empty:
        return []

    cell_deg = 10.0 / 111_111.0
    df["lat_cell"] = (df["lat"] / cell_deg).round().astype(int)
    df["lon_cell"] = (df["lon"] / cell_deg).round().astype(int)

    clusters: List[Dict[str, Any]] = []

    for (lat_cell, lon_cell), g in df.groupby(["lat_cell", "lon_cell"]):
        hits = len(g)
        if hits == 0:
            continue

        lat_mean = float(g["lat"].mean())
        lon_mean = float(g["lon"].mean())
        last_ts = g["ts"].max()
        avg_intensity = float(g["intensity"].mean())
        avg_stability = float(g["stability"].mean())
        mount_counts = g["mount_state"].value_counts().to_dict()
        avg_conf = float(g["confidence"].mean())

        exposure = float(hits)

        cluster_key = f"{lat_cell}:{lon_cell}"
        cluster_id = hashlib.sha1(cluster_key.encode("utf-8")).hexdigest()

        priority = float(avg_intensity * (0.5 + 0.5 * avg_conf))

        clusters.append(
            {
                "cluster_id": cluster_id,
                "lat": lat_mean,
                "lon": lon_mean,
                "hits": hits,
                "users": 1,
                "last_ts": last_ts.to_pydatetime(),
                "avg_intensity": avg_intensity,
                "avg_stability": avg_stability,
                "mount_state_counts": mount_counts,
                "exposure": exposure,
                "confidence": avg_conf,
                "priority": priority,
            }
        )

    return clusters


def _compute_rough_segments(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Branch B: road roughness segments (low quality stretches).
    Uses only stable windows and z-score RMS in ~40m cells.
    """
    segments: List[Dict[str, Any]] = []

    if df.empty:
        return segments

    df_geo = df.dropna(subset=["lat", "lon"]).copy()
    if df_geo.empty:
        return segments

    df_geo = df_geo[df_geo["stability"] <= 0.4]
    if df_geo.empty:
        return segments

    cell_deg = 40.0 / 111_111.0
    df_geo["lat_cell"] = (df_geo["lat"] / cell_deg).round().astype(int)
    df_geo["lon_cell"] = (df_geo["lon"] / cell_deg).round().astype(int)

    for (lat_cell, lon_cell), g in df_geo.groupby(["lat_cell", "lon_cell"]):
        if len(g) < 10:
            continue

        z_vals = g["z"].replace([np.inf, -np.inf], np.nan).dropna()
        if z_vals.empty:
            continue

        roughness = float(np.sqrt(np.mean(z_vals ** 2)))
        lat_mean = float(g["lat"].mean())
        lon_mean = float(g["lon"].mean())
        last_ts = g["ts"].max().to_pydatetime()

        segment_key = f"{lat_cell}:{lon_cell}"
        segment_id = hashlib.sha1(segment_key.encode("utf-8")).hexdigest()

        segments.append(
            {
                "segment_id": segment_id,
                "lat": lat_mean,
                "lon": lon_mean,
                "roughness": roughness,
                "rough_windows": int(len(z_vals)),
                "last_ts": last_ts,
            }
        )

    return segments


def process_trip_payload(
    payload: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Main entrypoint.

    Input:  payload (trip JSON from the app)
    Output: (detections, pothole_clusters_for_this_trip, rough_segments_for_this_trip)
    """
    samples = payload.get("samples") or []
    if not samples:
        return [], [], []

    df = pd.DataFrame(samples)
    if df.empty:
        return [], [], []

    df["ts"] = _to_datetime_series(df, payload)
    df = df.dropna(subset=["ts"])
    df = df.sort_values("ts").reset_index(drop=True)

    _normalize_columns(df)
    _compute_stability(df)
    _compute_zscore(df)

    detections = _detect_potholes(df)
    clusters = _cluster_potholes_for_trip(detections)
    rough_segments = _compute_rough_segments(df)

    return detections, clusters, rough_segments
