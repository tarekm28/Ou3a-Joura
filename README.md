# **Ou3a Joura! – Smart Crowdsourced Pothole & Road-Quality Detection for Lebanon**

Ou3a Joura! is a mobile + backend platform designed to **map potholes and damaged road segments in Lebanon** using only the sensors in a driver’s smartphone.

The system collects accelerometer, gyroscope, GPS, and speed readings from everyday trips, processes the data through a robust multi-layer pipeline, and generates **high-confidence pothole clusters** and **road roughness hotspots** that can be visualized on a map or provided to government agencies.

The project consists of two repositories combined in this GitHub directory:

* **Ou3a Joura App (Android)** – collects raw sensor data during trips and uploads it when online.
* **Ou3a Joura Backend (FastAPI + PostgreSQL)** – processes trips, detects potholes, clusters detections, and outputs map-ready GeoJSON files.

---

# **Features**

### ✅ Crowdsourced trip data collection (Android)

* Continuous accelerometer, gyroscope, GPS, and speed logging.
* Automatic trip segmentation and delayed upload when offline.

### ✅ Robust per-trip signal processing

* Phone stability estimation using gyroscope jitter.
* Vertical acceleration z-score normalization using robust MAD statistics.
* Speed-filtered and stability-filtered bump detection.
* Debouncing to avoid double-counting potholes.

### ✅ Cross-trip clustering & consensus

* DBSCAN spatial clustering using haversine distance.
* Confidence scoring per cluster using intensity, stability, user diversity, and recency.
* Likelihood classification: **very_likely**, **likely**, **uncertain**.
* Dashboard layer selects only the **top quantile of reliable clusters**.

---

# **Architecture Overview**

```
             ┌───────────────────────┐
             │   Ou3a Joura App      │
             │  (Android / Kotlin)   │
             └──────────┬────────────┘
                        │ uploads trips
                        ▼
             ┌───────────────────────────┐
             │       FastAPI Backend      │
             └──────────┬────────────────┘
                        │ stores raw trips
                        ▼
          ┌───────────────────────────────┐
          │        trip_raw (JSONB)       │
          └──────────┬────────────────────┘
                     │ processing task
                     ▼
          ┌───────────────────────────────┐
          │ Per-trip processing pipeline  │
          │ - stability scoring           │
          │ - z-score bump detection      │
          │ - timestamp debouncing        │
          └──────────┬────────────────────┘
                     │ detections
                     ▼
          ┌───────────────────────────────┐
          │           detections          │
          └──────────┬────────────────────┘
                     │ cluster all trips
                     ▼
       ┌─────────────────────────────────────────┐
       │ Spatial Clustering (DBSCAN + consensus) │
       └──────────┬──────────────────────────────┘
                  │ produce cluster summaries
                  ▼
       ┌────────────────────────────────────────┐
       │        pothole_clusters table         │
       └──────────┬────────────────────────────┘
                  │ export to GeoJSON
                  ▼
     ┌──────────────────────────────────────────────┐
     │       all.geojson / dashboard.geojson        │
     │                                              │
     └──────────────────────────────────────────────┘
```

---

# **Running Locally (Backend + App)**

### **1. Requirements**

* **Docker Desktop** (recommended)
* Python 3.11+ (only if using direct scripts)
* Android Studio (for building/running the app)

---

## **2. Running the Backend Locally**

The backend is fully containerized.

### **Step 1 — Navigate to the backend directory**

```
cd backend
```

### **Step 2 — Start PostgreSQL + FastAPI**

```
docker compose up --build
```

This will:

* Start PostgreSQL
* Apply the schema
* Start the FastAPI backend at:

```
http://localhost:8000
```

### **Step 3 — Verify API is running**

Open in browser:

```
http://localhost:8000/docs
```

You should see the interactive Swagger API.

---

## **3. Uploading Trips (local testing)**

Put your `.json` trip logs into `backend/trips/`.

Then run:

```
python upload_trips.py
```

This will:

* Read all `.json` files
* Send them to the backend
* Trigger full pothole + roughness generation

---

## **4. Exporting GeoJSON**

To generate fresh map layers:

```
python export_geojson.py
```

This produces:

* `all.geojson` – all clusters (debug)
* `new_dashboard.geojson` – high-confidence potholes


You can open them in:

* geojson.io
* QGIS
* Mapbox Studio

---

## **5. Running the Android App Locally**

### **Step 1 — Open `/app` in Android Studio**

### **Step 2 — Configure backend URL**

In your app configuration file (usually something like `ApiConfig.kt`):

```kotlin
const val BASE_URL = "http://10.0.2.2:8000"
```

> Note:
> For Android Emulator, `10.0.2.2` maps to `localhost`.

### **Step 3 — Install on emulator or real phone**

* Start a trip
* Drive around
* The app records sensor data
* Uploads automatically on stable connection

