import requests

BASE_URL = "http://localhost:8000"

def main():
    clusters = requests.get(
        f"{BASE_URL}/api/v1/clusters",
        params={"min_conf": 0.0, "limit": 1000},
    ).json()

    segments = requests.get(
        f"{BASE_URL}/api/v1/road_quality",
        params={"min_conf": 0.0, "limit": 1000},
    ).json()

    print(f"Pothole clusters: {len(clusters)}")
    if clusters:
        print("Sample cluster:", clusters[0])

if __name__ == "__main__":
    main()
