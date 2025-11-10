import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from datetime import datetime, timezone
import hashlib


def _safe_vec(v):
    """
    Ensure we always have a 3-vector of floats, or NaNs.
    """
    if isinstance(v, (list, tuple, np.ndarray)) and len(v) == 3:
        try:
            return np.array(v, dtype=float)
        except Exception:
            pass
    return np.array([np.nan, np.nan, np.nan], dtype=float)


def _estimate_gravity(accel_arr: np.ndarray, dt_arr: np.ndarray, tau: float = 0.5):
    """
    Simple exponential smoothing to estimate gravity vector in phone frame.

    accel_arr: Nx3 array of raw accelerometer readings.
    dt_arr:    N array of timestep lengths in seconds.
    tau:       smoothing time constant (~0.5 s works fine).
    """
    gravity = np.zeros_like(accel_arr)
    g_prev = None
    for i, a in enumerate(accel_arr):
        if np.isnan(a).any():
            gravity[i] = g_prev if g_prev is not None else np.zeros(3)
            continue
        dt = dt_arr[i]
        if not np.isfinite(dt) or dt <= 0:
            dt = tau
        alpha = dt / (tau + dt)
        if g_prev is None or np.isnan(g_prev).any():
            g_prev = a
        g_prev = alpha * a + (1.0 - alpha) * g_prev
        gravity[i] = g_prev
    return gravity


def _stability_label(score: float) -> str:
    """
    Qualitative label for mount stability.
    score in [0,1], 0 = very stable, 1 = very chaotic.
    """
    if not np.isfinite(score):
        return "unknown"
    if score < 0.25:
        return "stable"    # very likely in holder / wedged solidly
    if score < 0.65:
        return "loose"     # cup holder / dashboard
    return "handheld"      # lots of jitter


def _rolling_mad(series: pd.Series, window: int, min_periods: int = 1):
    """
    Rolling Median Absolute Deviation (MAD), scaled to std-like units.
    Robust against occasional spikes.
    """

    def _mad(x):
        arr = x[~np.isnan(x)]
        if arr.size == 0:
            return np.nan
        med = np.median(arr)
        mad = np.median(np.abs(arr - med))
        return mad * 1.4826  # scale MAD so that for a normal dist it's ~std

    return series.rolling(window, min_periods=min_periods).apply(_mad, raw=False)


def _to_dt(s):  # ISO8601 → pandas datetime (timezone-aware UTC)
    return pd.to_datetime(s, utc=True, errors="coerce")


def process_trip_payload(payload: dict):
    """
    Input:  payload (parsed JSON from the app)
    Output: (detections, clusters)

      detections: list of per-event dicts
        {
          ts,            # datetime (tz-aware UTC)
          lat, lon,      # floats or None
          intensity,     # float (z-score)
          stability,     # float in [0,1]
          mount_state    # "stable" | "loose" | "handheld" | "unknown"
        }

      clusters:   list of clustered pothole dicts
        {
          cluster_id,
          lat, lon,
          hits, users,
          last_ts,
          avg_intensity,
          avg_stability,
          mount_state_counts,
          exposure,
          confidence,
          priority,
        }
    """
    samples = payload.get("samples", [])
    if not samples:
        return [], []

    df = pd.DataFrame(samples)

    # Need timestamps + accel
    if "timestamp" not in df.columns or "accel" not in df.columns:
        return [], []

    # If gyro missing, fill with NaNs so code still works
    if "gyro" not in df.columns:
        df["gyro"] = [[np.nan, np.nan, np.nan]] * len(df)

    # Sort by time & parse timestamps
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["ts"] = df["timestamp"].apply(_to_dt)
    if df["ts"].isna().all():
        return [], []

    # Flatten sensor arrays
    accel_arr = np.vstack(df["accel"].apply(_safe_vec).to_numpy())
    gyro_arr = np.vstack(df["gyro"].apply(_safe_vec).to_numpy())

    # Geospatial info
    df["lat"] = df.get("latitude")
    df["lon"] = df.get("longitude")

    # Speed (m/s) if available
    if "speed_mps" in df.columns:
        df["speed_mps"] = pd.to_numeric(df["speed_mps"], errors="coerce")
    else:
        df["speed_mps"] = np.nan

    # Magnitudes
    accel_mag = np.linalg.norm(accel_arr, axis=1)
    gyro_mag = np.linalg.norm(gyro_arr, axis=1)
    df["gyro_mag"] = gyro_mag

    # Estimate dt between samples
    dt = df["ts"].diff().dt.total_seconds().to_numpy()
    if not np.isfinite(dt).any():
        dt = np.zeros_like(accel_mag)
    median_dt = np.nanmedian(dt[np.isfinite(dt) & (dt > 0)])
    if not np.isfinite(median_dt):
        median_dt = 0.01  # ~100 Hz fallback
    dt = np.where(np.isfinite(dt) & (dt > 0), dt, median_dt)

    # Gravity estimation + gravity-removed acceleration
    gravity = _estimate_gravity(accel_arr, dt)
    lin_accel = accel_arr - gravity
    lin_accel_mag = np.linalg.norm(lin_accel, axis=1)
    df["accel_mag"] = accel_mag
    df["lin_accel_mag"] = lin_accel_mag

    # Robust rolling baseline using median + MAD
    window = 10  # ~0.5–1s depending on sample rate
    roll_med = df["lin_accel_mag"].rolling(window, min_periods=5).median()
    roll_mad = _rolling_mad(df["lin_accel_mag"], window, min_periods=5)
    z = (df["lin_accel_mag"] - roll_med) / (roll_mad.replace(0, np.nan))
    z = z.replace([np.inf, -np.inf], np.nan)
    df["z"] = z

    # ---------- phone stability classifier ----------
    # Gravity direction jitter (orientation) + high-frequency shake (noise).
    g_norm = np.linalg.norm(gravity, axis=1)
    g_norm[g_norm == 0] = np.nan
    g_unit = gravity / g_norm[:, None]

    lin_df = pd.DataFrame(lin_accel, columns=["ax", "ay", "az"])
    # Simple "high-pass": subtract local mean
    hp = lin_df - lin_df.rolling(10, min_periods=1, center=True).mean()
    hf_mag = np.sqrt((hp**2).sum(axis=1))

    # Group into 1-second windows
    df["window_start"] = df["ts"].dt.floor("s")

    window_metrics = []
    for w_start, idxs in df.groupby("window_start").groups.items():
        if pd.isna(w_start):
            continue
        idx_list = list(idxs)

        # Orientation jitter (std of angle between gravity vectors)
        g_window = g_unit[idx_list]
        valid_g = g_window[~np.isnan(g_window).any(axis=1)]
        if valid_g.size == 0:
            jitter = 0.0
        else:
            mean_dir = np.nanmean(valid_g, axis=0)
            norm = np.linalg.norm(mean_dir)
            if norm == 0 or not np.isfinite(norm):
                jitter = 0.0
            else:
                mean_dir /= norm
                angles = []
                for vec in valid_g:
                    dot = np.clip(float(np.dot(vec, mean_dir)), -1.0, 1.0)
                    angles.append(np.arccos(dot))
                jitter = float(np.std(angles)) if len(angles) > 1 else 0.0

        # High-frequency energy (how much the phone is being "shaken")
        hf_window = hf_mag[idx_list]
        hf_window = hf_window[np.isfinite(hf_window)]
        hf_rms = float(np.sqrt(np.mean(hf_window**2))) if hf_window.size else 0.0

        window_metrics.append(
            {"window_start": w_start, "jitter": jitter, "hf_rms": hf_rms}
        )

    state_map = {}
    stability_map = {}

    if window_metrics:
        jitters = np.array([m["jitter"] for m in window_metrics])
        energies = np.array([m["hf_rms"] for m in window_metrics])

        jitter_mad = np.median(np.abs(jitters - np.median(jitters)))
        energy_mad = np.median(np.abs(energies - np.median(energies)))

        if not np.isfinite(jitter_mad) or jitter_mad <= 0:
            jitter_mad = max(np.std(jitters), 1e-3)
        if not np.isfinite(energy_mad) or energy_mad <= 0:
            energy_mad = max(np.std(energies), 1e-3)

        for metrics in window_metrics:
            j_norm = metrics["jitter"] / (1e-3 + jitter_mad)
            e_norm = metrics["hf_rms"] / (1e-3 + energy_mad)

            # squish into [0,1], higher = more chaotic / handheld
            stability = 1.0 - np.exp(-0.6 * j_norm) * np.exp(-0.6 * e_norm)
            stability = float(np.clip(stability, 0.0, 1.0))

            w_start = metrics["window_start"]
            stability_map[w_start] = stability
            state_map[w_start] = _stability_label(stability)

    df["stability"] = df["window_start"].map(stability_map).fillna(0.0)
    df["mount_state"] = df["window_start"].map(state_map).fillna("stable")

    # ---------- dynamic thresholds ----------
    # CHANGE 1: Higher thresholds for Lebanese roads + old car
    base_z = 3.5          # WAS 2.8 - only detect significant spikes
    base_debounce = 1.0   # WAS 0.5 - prevent multiple detections per pothole

    # Dynamic z-threshold: ~3.5 for very stable, higher for chaotic phone
    df["z_thresh"] = base_z + df["stability"]  # WAS: base_z + 0.8 * df["stability"]

    # Speed gate: ignore events below ~10.8 km/h
    speed_series = df["speed_mps"]
    has_speed = speed_series.notna().any()
    if has_speed:
        speed_ok = speed_series.fillna(0.0) >= 3.0  # 3 m/s ≈ 10.8 km/h
    else:
        # If GPS speed is missing, don't filter on speed.
        speed_ok = pd.Series(True, index=df.index)

    # CHANGE 2: Peak detection - only detect local maxima, not every high sample
    df["is_peak"] = (
        (df["z"] > df["z"].shift(1).fillna(-np.inf)) &
        (df["z"] >= df["z"].shift(-1).fillna(-np.inf))
    )

    # Candidate events: only PEAKS that are big z-spikes while moving at reasonable speed
    candidates = df[
        df["is_peak"] &  # NEW: Only peaks
        (df["z"] > df["z_thresh"]) &
        speed_ok
    ].copy()

    # ---------- debounce with stability awareness ----------
    detections = []
    last_ts = None
    last_stability = 0.0

    for _, r in candidates.iterrows():
        if pd.isna(r["ts"]):
            continue

        stab = float(r["stability"]) if not np.isnan(r["stability"]) else 0.0
        # more chaotic phone = require events to be further apart
        min_gap = base_debounce * (1.0 + max(stab, last_stability))

        if last_ts is not None and (r["ts"] - last_ts).total_seconds() < min_gap:
            continue

        detections.append(
            {
                "ts": r["ts"].to_pydatetime(),
                "lat": None if pd.isna(r["lat"]) else float(r["lat"]),
                "lon": None if pd.isna(r["lon"]) else float(r["lon"]),
                "intensity": float(r["z"]) if not np.isnan(r["z"]) else 0.0,
                "stability": stab,
                "mount_state": r.get("mount_state", "stable"),
            }
        )
        last_ts = r["ts"]
        last_stability = stab

    # Only keep detections that actually have coordinates for clustering
    det_geo = [d for d in detections if d["lat"] is not None and d["lon"] is not None]
    if not det_geo:
        return detections, []

    # ---------- spatial clustering (per-trip) ----------
    # ~12 m radius in degrees (approx; good enough at city scale)
    eps_deg = 12.0 / 111_111.0
    X = np.array([[d["lat"], d["lon"]] for d in det_geo])

    clustering = DBSCAN(eps=eps_deg, min_samples=3, metric="euclidean").fit(X)
    labels = clustering.labels_

    clusters = []
    for lbl in set(labels):
        if lbl == -1:
            continue  # noise

        pts = [det_geo[i] for i in range(len(det_geo)) if labels[i] == lbl]
        if not pts:
            continue

        lat = float(np.mean([p["lat"] for p in pts]))
        lon = float(np.mean([p["lon"] for p in pts]))
        hits = len(pts)
        users = 1  # per-trip; cross-trip aggregation happens in DB
        last_ts = max(p["ts"] for p in pts)

        # Weighted intensity: stable mount counts more
        intensity_records = [
            (p["intensity"], max(0.0, 1.0 - p.get("stability", 0.0)))
            for p in pts
            if p.get("intensity") is not None
        ]
        if intensity_records:
            intensities, weights = zip(*intensity_records)
            weight_total = sum(weights)
            if weight_total > 0:
                weighted_sum = sum(i * w for i, w in zip(intensities, weights))
                avg_int = float(weighted_sum / weight_total)
            else:
                avg_int = float(np.mean(intensities))
        else:
            avg_int = 0.0

        avg_stability = float(
            np.mean([p.get("stability", 0.0) for p in pts])
        ) if pts else 0.0

        mount_states = {}
        for p in pts:
            state = p.get("mount_state")
            if state:
                mount_states[state] = mount_states.get(state, 0) + 1

        # Freshness term (last 60 days fades to 0).
        now_utc = datetime.now(tz=timezone.utc)
        if last_ts.tzinfo is None:
            last_ts_aware = last_ts.replace(tzinfo=timezone.utc)
        else:
            last_ts_aware = last_ts
        freshness = max(0.0, 1.0 - (now_utc - last_ts_aware).days / 60.0)

        # Confidence: hits + freshness + intensity, but down-weighted if unstable
        stability_weight = float(
            np.mean([max(0.0, 1.0 - p.get("stability", 0.0)) for p in pts])
        ) if pts else 0.0

        confidence = (
            0.3 * (min(hits, 10) / 10.0) * stability_weight
            + 0.6 * freshness
            + 0.1 * avg_int
        )

        # TODO: exposure (e.g. cars passing road segment) – for now 0.
        exposure = 0.0
        priority = 0.6 * confidence + 0.4 * exposure

        # CHANGE 3: Coarse clustering to handle GPS variance across trips
        # 4 decimal places = ~11m radius instead of 6 decimal places = ~0.1m
        cid_src = f"{round(lat, 4)}:{round(lon, 4)}"  # WAS: round(lat, 6)
        cluster_id = "pc_" + hashlib.sha1(cid_src.encode()).hexdigest()[0:10]

        clusters.append(
            {
                "cluster_id": cluster_id,
                "lat": lat,
                "lon": lon,
                "hits": hits,
                "users": users,
                "last_ts": last_ts_aware,
                "avg_intensity": avg_int,
                "avg_stability": avg_stability,
                "mount_state_counts": mount_states,
                "exposure": exposure,
                "confidence": confidence,
                "priority": priority,
            }
        )

    return detections, clusters