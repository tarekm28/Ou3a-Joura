import json
import math
from pathlib import Path

import requests


BACKEND_URL = "http://localhost:8000"
OUT_DIR = Path(".")

# output filenames
NEW_ALL_FILE = OUT_DIR / "new_all.geojson"
NEW_DASHBOARD_FILE = OUT_DIR / "new_dashboard.geojson"
NEW_DETECTIONS_FILE = OUT_DIR / "new_detections.geojson" 
# quantile for dashboard selection among non-uncertain clusters
DASHBOARD_QUANTILE = 0.6


def fetch_clusters(min_conf: float = 0.0, limit: int = 1000):
    params = {"min_conf": min_conf, "limit": limit}
    resp = requests.get(f"{BACKEND_URL}/api/v1/clusters", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_detections(min_intensity: float = 0.0, limit: int = 5000):
    """
    Fetch raw suspicious detections (pre-clustering).
    Requires /api/v1/detections endpoint.
    """
    params = {"min_intensity": min_intensity, "limit": limit}
    resp = requests.get(f"{BACKEND_URL}/api/v1/detections", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def percentile(values, q: float) -> float:
    if not values:
        raise ValueError("Cannot compute percentile of empty list")
    vals = sorted(values)
    if len(vals) == 1:
        return vals[0]
    k = (len(vals) - 1) * q
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return vals[int(k)]
    d0 = vals[f] * (c - k)
    d1 = vals[c] * (k - f)
    return d0 + d1


def clusters_to_geojson(clusters):
    features = []
    for c in clusters:
        lat = c.get("latitude")
        lon = c.get("longitude")
        if lat is None or lon is None:
            continue

        props = {
            "cluster_id": c.get("cluster_id"),
            "confidence": c.get("confidence"),
            "priority": c.get("priority"),
            "likelihood": c.get("likelihood"),
            "hits": c.get("hits"),
            "users": c.get("users"),
            "avg_intensity": c.get("avg_intensity"),
            "avg_stability": c.get("avg_stability"),
            "exposure": c.get("exposure"),
            "last_ts": c.get("last_ts"),
            "is_dashboard": c.get("is_dashboard", False),
        }

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props,
            }
        )

    return {"type": "FeatureCollection", "features": features}


def detections_to_geojson(detections):
    """
    Convert raw detections to GeoJSON points.
    Each point = one suspicious spike pre-clustering.
    """
    features = []
    for d in detections:
        lat = d.get("latitude") or d.get("lat")
        lon = d.get("longitude") or d.get("lon")
        if lat is None or lon is None:
            continue

        props = {
            "trip_id": d.get("trip_id"),
            "ts": d.get("ts"),
            "intensity": d.get("intensity"),
            "stability": d.get("stability"),
            "mount_state": d.get("mount_state"),
        }

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props,
            }
        )

    return {"type": "FeatureCollection", "features": features}



def main():
    # --- raw detections (pre clustering) ---
    print("Fetching RAW detections (pre-clustering spikes)...")
    detections_all = fetch_detections(min_intensity=0.0, limit=20000)
    print(f"  got {len(detections_all)} detections")

    # --- pothole clusters ---
    print("Fetching ALL clusters (no confidence cut, for debugging + dashboard selection)...")
    clusters_all = fetch_clusters(min_conf=0.0, limit=5000)
    print(f"  got {len(clusters_all)} clusters")

    for c in clusters_all:
        c["is_dashboard"] = False

    candidates = [c for c in clusters_all if c.get("likelihood") != "uncertain"]

    if candidates:
        conf_values = [float(c.get("confidence", 0.0)) for c in candidates]
        conf_thresh = percentile(conf_values, DASHBOARD_QUANTILE)
        print(
            f"Dashboard selection based on {len(candidates)} non-uncertain clusters; "
            f"{DASHBOARD_QUANTILE*100:.0f}th percentile of confidence = {conf_thresh:.3f}"
        )

        for c in candidates:
            if float(c.get("confidence", 0.0)) >= conf_thresh:
                c["is_dashboard"] = True
    else:
        print("No non-uncertain clusters → dashboard will be empty.")

    clusters_dashboard = [c for c in clusters_all if c.get("is_dashboard")]
    print(f"  dashboard clusters after quantile cut: {len(clusters_dashboard)}")


    # Convert to GeoJSON
    detections_geojson = detections_to_geojson(detections_all)
    potholes_all_geojson = clusters_to_geojson(clusters_all)
    potholes_dash_geojson = clusters_to_geojson(clusters_dashboard)

    # Save
    NEW_DETECTIONS_FILE.write_text(json.dumps(detections_geojson, indent=2), encoding="utf-8")
    NEW_ALL_FILE.write_text(json.dumps(potholes_all_geojson, indent=2), encoding="utf-8")
    NEW_DASHBOARD_FILE.write_text(json.dumps(potholes_dash_geojson, indent=2), encoding="utf-8")

    print(f"Saved RAW detections to:      {NEW_DETECTIONS_FILE}")
    print(f"Saved ALL clusters to:        {NEW_ALL_FILE}")
    print(f"Saved DASHBOARD clusters to:  {NEW_DASHBOARD_FILE}")
    print("Open these in geojson.io or QGIS.")


if __name__ == "__main__":
    main()
