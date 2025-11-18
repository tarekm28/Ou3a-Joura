import json
import pathlib
import requests

BASE_URL = "http://localhost:8000"
TRIPS_DIR = pathlib.Path("trips")

def main():
    for path in sorted(TRIPS_DIR.glob("*.json")):
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        trip_id = payload.get("trip_id", path.stem)
        print(f"Uploading {path.name} (trip_id={trip_id})... ", end="", flush=True)

        resp = requests.post(f"{BASE_URL}/api/v1/trips", json=payload)
        print(resp.status_code, resp.text)

if __name__ == "__main__":
    main()
