import json
from pathlib import Path

import requests


BACKEND_URL = "http://localhost:8000"

OUT_DIR = Path(".")
POTHOLES_ALL_FILE = OUT_DIR / "potholes_all.geojson"
POTHOLES_DASHBOARD_FILE = OUT_DIR / "potholes_dashboard.geojson"
ROUGH_ROADS_FILE = OUT_DIR / "rough_roads.geojson"


def fetch_clusters(min_conf: float = 0.0, limit: int = 1000, dashboard: bool = False):
    """Fetch pothole clusters from the backend."""
    params = {
        "min_conf": min_conf,
        "limit": limit,
        "dashboard": "true" if dashboard else "false",
    }
    resp = requests.get(f"{BACKEND_URL}/api/v1/clusters", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_rough_roads(min_conf: float = 0.4, limit: int = 1000):
    """Fetch rough road segments from the backend."""
    params = {
        "min_conf": min_conf,
        "limit": limit,
    }
    resp = requests.get(f"{BACKEND_URL}/api/v1/road_quality", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def clusters_to_geojson(clusters):
    """Convert list of cluster dicts to a GeoJSON FeatureCollection."""
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
        }

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
                "properties": props,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def rough_roads_to_geojson(segments):
    """
    Convert rough road segments to GeoJSON points.

    Each segment is currently a "representative" location with a roughness score.
    """
    features = []
    for s in segments:
        lat = s.get("latitude")
        lon = s.get("longitude")
        if lat is None or lon is None:
            continue

        props = {
            "segment_id": s.get("segment_id"),
            "roughness": s.get("roughness"),
            "rough_windows": s.get("rough_windows"),
            "trips": s.get("trips"),
            "confidence": s.get("confidence"),
            "last_ts": s.get("last_ts"),
        }

        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
                "properties": props,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def main():
    print("Fetching ALL clusters (no confidence cut, for debugging)...")
    clusters_all = fetch_clusters(min_conf=0.0, limit=5000, dashboard=False)
    print(f"  got {len(clusters_all)} clusters")

    print("Fetching DASHBOARD clusters (quantile-based confidence)...")
    clusters_dashboard = fetch_clusters(min_conf=0.0, limit=5000, dashboard=True)
    print(f"  got {len(clusters_dashboard)} high-confidence clusters")

    print("Fetching rough road segments...")
    rough_segments = fetch_rough_roads(min_conf=0.0, limit=5000)
    print(f"  got {len(rough_segments)} rough road segments")

    # Convert to GeoJSON
    potholes_all_geojson = clusters_to_geojson(clusters_all)
    potholes_dash_geojson = clusters_to_geojson(clusters_dashboard)
    rough_roads_geojson = rough_roads_to_geojson(rough_segments)

    # Save
    POTHOLES_ALL_FILE.write_text(json.dumps(potholes_all_geojson, indent=2), encoding="utf-8")
    POTHOLES_DASHBOARD_FILE.write_text(json.dumps(potholes_dash_geojson, indent=2), encoding="utf-8")
    ROUGH_ROADS_FILE.write_text(json.dumps(rough_roads_geojson, indent=2), encoding="utf-8")

    print(f"Saved ALL clusters to:        {POTHOLES_ALL_FILE}")
    print(f"Saved DASHBOARD clusters to:  {POTHOLES_DASHBOARD_FILE}")
    print(f"Saved rough roads to:         {ROUGH_ROADS_FILE}")
    print("Now open these .geojson files in a map viewer (geojson.io, QGIS, etc.).")


if __name__ == "__main__":
    main()
