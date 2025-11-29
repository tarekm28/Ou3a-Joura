# **Ou3a Joura! – Smart Crowdsourced Pothole & Road-Quality Detection for Lebanon**

Ou3a Joura! is a complete mobile + backend + frontend platform designed to **map potholes and damaged road segments in Lebanon** using only the sensors in a driver's smartphone.

The system collects accelerometer, gyroscope, GPS, and speed readings from everyday trips, processes the data through a robust multi-layer pipeline, and generates **high-confidence pothole clusters** that can be visualized on an interactive dashboard or provided to government agencies for infrastructure planning.

This repository contains three integrated components:

* **Ou3a Joura Android App** – Kotlin app that collects raw sensor data during trips and allows manual upload
* **Ou3a Joura Backend** – FastAPI + PostgreSQL server that processes trips, detects potholes, and clusters detections
* **Ou3a Joura Frontend** – React + TypeScript dashboard with interactive map, filtering, and statistics

---

# **Features**

### ✅ Android App
* Foreground service for continuous sensor collection (200ms sampling rate)
* Records accelerometer, gyroscope, GPS, and speed data
* Sensor fusion with time-synchronized accel + gyro readings
* JSON trip files stored locally on device
* **Manual upload** via button press (no automatic background upload)
* Clear uploaded trips to free storage

### ✅ Backend Processing Pipeline
* Phone stability estimation using gyroscope jitter
* Vertical acceleration z-score normalization using robust MAD statistics
* Speed-filtered and stability-filtered bump detection (z-score > 5.0)
* Temporal debouncing (0.7s) to avoid duplicate detections
* Stores raw detections in PostgreSQL database

### ✅ Clustering & Confidence Scoring
* DBSCAN spatial clustering (5m radius, haversine distance metric)
* Confidence formula: `0.45×coverage + 0.25×hits + 0.20×intensity + 0.10×stability × recency`
* Priority score: `0.7×confidence + 0.3×intensity×(1-stability)`
* Likelihood classification: **very_likely** (≥66%), **likely** (≥40%), **uncertain** (<40%)

### ✅ Interactive Dashboard
* React + Leaflet map with cluster markers
* Color-coded by likelihood (red=very_likely, orange=likely, yellow=uncertain)
* Filter by likelihood category
* Statistics panel with total clusters, average confidence, intensity, and stability
* Sortable data table with all cluster metrics
* Real-time updates from backend API

---

# **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ou3a Joura Android App                       │
│  - Records sensor data (accel, gyro, GPS @ 200ms)             │
│  - Saves trips as JSON files locally                           │
│  - Manual upload via button                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/v1/trips
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                      │
│  - Receives trip JSON                                          │
│  - Background processing task                                  │
│  - Stores in PostgreSQL                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │     Processing Pipeline              │
         │  1. Normalize sensor columns         │
         │  2. Compute stability (gyro jitter)  │
         │  3. Compute z-scores (MAD-based)     │
         │  4. Detect potholes (z>5.0)          │
         │  5. Debounce (0.7s window)           │
         └──────────────┬───────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────────────┐
         │      PostgreSQL Database             │
         │  - trip_raw (JSONB)                  │
         │  - detections (individual events)    │
         └──────────────┬───────────────────────┘
                        │ GET /api/v1/clusters
                        ▼
         ┌──────────────────────────────────────┐
         │   DBSCAN Clustering (on-the-fly)     │
         │  - 5m radius spatial clustering      │
         │  - Confidence + Priority scoring     │
         │  - Likelihood classification         │
         └──────────────┬───────────────────────┘
                        │ JSON API response
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              React Frontend Dashboard                           │
│  - Interactive Leaflet map                                     │
│  - Filtering (likelihood, dashboard mode)                      │
│  - Statistics panel + sortable data table                      │
│  - Nginx reverse proxy (/api/* → backend)                      │
└─────────────────────────────────────────────────────────────────┘
```
---

# **🌐 Live Demo**

The application is currently hosted and accessible at:

### **[http://46.224.80.70](http://46.224.80.70)**

This live deployment runs on a Hetzner Cloud server with:
- PostgreSQL 16 database
- FastAPI backend processing engine
- React frontend dashboard
- Real trip data from Lebanon

---

# **Running Locally**

## **Prerequisites**

* **Docker Desktop** (required for backend + frontend)
* **Android Studio** (for building the Android app)
* **Git** (to clone the repository)

---

## **Quick Start with Docker (Recommended)**

The entire backend + frontend stack runs with a single command.

### **Step 1: Clone the repository**

```bash
git clone https://github.com/tarekm28/Ou3a-Joura.git
cd Ou3a-Joura
```

### **Step 2: Start all services**

```bash
docker compose up --build
```

This will start:
- **PostgreSQL** database on port `5432`
- **FastAPI backend** on `http://localhost:8000`
- **React frontend** on `http://localhost:3000`

### **Step 3: Access the dashboard**

Open your browser to:
```
http://localhost:3000
```

You should see the interactive map dashboard.

### **Step 4: Verify backend API**

Open the FastAPI docs:
```
http://localhost:8000/docs
```

---

## **Uploading Trip Data**

The Android app is designed to upload trips manually, but for local testing you can use the included Python script.

### **Option 1: Upload sample trips (included in repo)**

16 real trip files are included in `Ou3a Joura Backend/trips/`.

```bash
cd "Ou3a Joura Backend"
python upload_trips.py
```

This will:
- Read all `.json` files from the `trips/` folder
- Upload them to `http://localhost:8000/api/v1/trips`
- Trigger backend processing
- Generate detections and clusters

**Note:** Make sure backend is running first via Docker.

### **Option 2: Upload from Android app**

1. Build and install the app (see Android App Setup below)
2. Configure the backend URL in the app to point to your local machine
3. Record a trip by pressing "Start Recording"
4. Press "Stop Recording" when done
5. Press "Upload Trips" to manually upload
6. Check the dashboard to see new clusters appear

---

## **Android App Setup**

### **Step 1: Open in Android Studio**

```bash
cd "Ou3a Joura Android App"
```

Open this folder in Android Studio.

### **Step 2: Configure backend URL**

**⚠️ IMPORTANT:** The app has placeholder IP `0.0.0.0:0` by default. You need to update it.

Edit `MainActivity.kt` line ~66:

```kotlin
val url = URL("http://YOUR_LOCAL_IP:8000/api/v1/trips")
```

**For local testing:**
- If using Android Emulator: use `http://10.0.2.2:8000/api/v1/trips`
- If using physical device: use your computer's local IP (e.g., `http://192.168.1.100:8000/api/v1/trips`)

### **Step 3: Build and run**

1. Connect your Android device or start an emulator
2. Click **Run** in Android Studio
3. Grant location permissions when prompted

### **Step 4: Record a trip**

1. Press **Start Recording** button
2. Drive around (or walk with the phone)
3. Press **Stop Recording** when done
4. Trip is saved locally to `/sdcard/Android/data/com.ou3a.joura/files/trips/`

### **Step 5: Upload trips**

1. Press **Upload Trips** button
2. App will upload all trips from local storage
3. Successfully uploaded trips are moved to `/uploaded/` subfolder
4. Check backend logs or dashboard to verify processing

### **Step 6: Clear uploaded trips (optional)**

Press **Clear Uploaded Trips** to delete the `/uploaded/` folder and free storage.

---

## **Exporting GeoJSON Files**

For offline analysis or integration with GIS tools:

```bash
cd "Ou3a Joura Backend"
python export_geojson.py
```

This generates:
- `new_all.geojson` – all clusters (debug view)
- `new_dashboard.geojson` – high-confidence clusters only (top 66th percentile)
- `new_detections.geojson` – raw detection points

You can open these files in:
- [geojson.io](https://geojson.io)
- QGIS
- Mapbox Studio
- Any GIS software

---

## **API Endpoints**

### **POST /api/v1/trips**
Upload a trip JSON file.

**Request body:**
```json
{
  "user_id": "uuid-string",
  "trip_id": "trip_20250129_123456",
  "start_time": "2025-01-29T12:34:56.000Z",
  "samples": [
    {
      "timestamp": "2025-01-29T12:34:56.200Z",
      "uptime_ms": 123456,
      "latitude": 33.8938,
      "longitude": 35.5018,
      "accuracy_m": 5.0,
      "speed_mps": 8.5,
      "accel": [0.1, -0.2, 9.8],
      "gyro": [0.01, -0.02, 0.005]
    }
  ],
  "end_time": "2025-01-29T12:45:00.000Z",
  "sample_count": 3000
}
```

**Response:** `200 OK` with trip_id

### **GET /api/v1/clusters**
Retrieve all pothole clusters.

**Query parameters:**
- `likelihood` (optional): Filter by likelihood category (`very_likely`, `likely`, `uncertain`)
- `dashboard` (optional): If `true`, returns only top 66th percentile by confidence

**Response:**
```json
{
  "clusters": [
    {
      "cluster_id": "abc123...",
      "latitude": 33.8938,
      "longitude": 35.5018,
      "hits": 15,
      "users": 3,
      "confidence": 0.78,
      "likelihood": "very_likely",
      "avg_intensity": 12.5,
      "avg_stability": 0.85,
      "priority": 0.72,
      "last_detection": "2025-01-29T12:45:00.000Z"
    }
  ]
}
```

### **GET /api/v1/detections**
Retrieve raw detection points (used by export script).

**Query parameters:**
- `limit` (optional): Max results (default: 10000)
- `offset` (optional): Pagination offset (default: 0)

---

## **Database Schema**

The PostgreSQL database has 2 main tables:

### **trip_raw**
Stores uploaded trip JSON files.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-increment primary key |
| trip_id | VARCHAR | Unique trip identifier |
| user_id | VARCHAR | User UUID from app |
| payload | JSONB | Full trip JSON with samples |
| uploaded_at | TIMESTAMP | Upload timestamp |

### **detections**
Stores individual pothole detection events.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-increment primary key |
| trip_id | VARCHAR | Foreign key to trip_raw |
| ts | TIMESTAMP | Detection timestamp |
| latitude | DOUBLE | GPS latitude |
| longitude | DOUBLE | GPS longitude |
| intensity | DOUBLE | Z-score magnitude |
| stability | DOUBLE | Phone stability (0-1) |
| mount_state | VARCHAR | Detected mount position |

**Note:** Clustering happens on-the-fly via the `/api/v1/clusters` endpoint using DBSCAN on detection coordinates.

---

## **Technology Stack**

### **Backend**
- FastAPI (Python web framework)
- PostgreSQL 16 (database)
- asyncpg (async PostgreSQL driver)
- pandas + numpy (data processing)
- scikit-learn (DBSCAN clustering)

### **Frontend**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Leaflet (mapping)
- Lucide React (icons)
- Nginx (production server)

### **Android App**
- Kotlin
- Foreground Service (sensor collection)
- Sensor Manager (accelerometer + gyroscope)
- Fused Location Provider (GPS)
- Gson (JSON serialization)
- SharedPreferences (user ID storage)

### **DevOps**
- Docker + Docker Compose
- Multi-stage Docker builds
- Nginx reverse proxy

---

## **Troubleshooting**

### **Docker containers won't start**
```bash
# Check Docker Desktop is running
docker ps

# View logs
docker compose logs backend
docker compose logs frontend
docker compose logs db

# Restart containers
docker compose down
docker compose up --build
```

### **Android app can't connect to backend**
- **Emulator:** Use `http://10.0.2.2:8000/api/v1/trips`
- **Physical device:** Use your computer's local IP (e.g., `http://192.168.1.100:8000`)
- Check firewall settings on your computer
- Verify backend is running: `curl http://localhost:8000/health`

### **No clusters appearing on dashboard**
- Upload trips first (either via Android app or `upload_trips.py`)
- Check backend logs: `docker compose logs backend`
- Verify detections in database: visit `http://localhost:8000/docs` → try `/api/v1/detections`
- Refresh dashboard page

### **Permission denied on Android app**
- Grant location permission in Settings → Apps → Ou3a Joura → Permissions
- Grant notification permission (Android 13+)
- For emulator: enable location in emulator settings

### **Trip upload fails from Android app**
- Check network connectivity
- Verify backend URL is correct (not `0.0.0.0:0`)
- Check backend logs for errors
- Try uploading via Postman/curl to verify backend is accepting requests

---

## **Project Structure**

```
Ou3a-Joura/
├── README.md
├── docker-compose.yml                    # Orchestrates all services
│
├── Ou3a Joura Backend/                   # FastAPI backend
│   ├── app/
│   │   ├── main.py                       # FastAPI app + endpoints
│   │   ├── processing.py                 # Sensor processing pipeline
│   │   ├── tasks.py                      # Background processing
│   │   └── config.py                     # Environment config
│   ├── trips/                            # Sample trip data (16 files)
│   ├── schema.sql                        # Database schema
│   ├── upload_trips.py                   # Upload script
│   ├── export_geojson.py                 # GeoJSON export script
│   ├── requirements.txt                  # Python dependencies
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── Ou3a Joura Frontend/                  # React dashboard
│   ├── src/
│   │   ├── App.tsx                       # Main app component
│   │   ├── components/
│   │   │   ├── MapView.tsx               # Leaflet map
│   │   │   ├── DataTable.tsx             # Sortable table
│   │   │   ├── StatisticsPanel.tsx       # Stats display
│   │   │   └── Filters.tsx               # Likelihood filters
│   │   └── services/
│   │       └── api.ts                    # Backend API client
│   ├── nginx.conf                        # Production Nginx config
│   ├── Dockerfile                        # Multi-stage build
│   ├── package.json
│   └── vite.config.ts
│
└── Ou3a Joura Android App/               # Kotlin Android app
    ├── app/
    │   └── src/main/java/com/ou3a/joura/
    │       ├── MainActivity.kt            # UI + upload logic
    │       ├── TripRecorderService.kt     # Foreground service
    │       ├── JsonTripWriter.kt          # Trip JSON writer
    │       ├── UploadWorker.kt            # WorkManager uploader
    │       └── IdManager.kt               # User ID management
    ├── build.gradle.kts
    └── settings.gradle.kts
```

---

## **How It Works**

### **1. Data Collection (Android)**
- User starts recording via foreground service
- Sensors sampled at 200ms intervals:
  - Accelerometer (3-axis: x, y, z in m/s²)
  - Gyroscope (3-axis angular velocity in rad/s)
  - GPS (latitude, longitude, accuracy, speed)
- Samples written to JSON file with timestamps
- File saved to local storage when user stops recording

### **2. Processing Pipeline (Backend)**
Each uploaded trip goes through:

1. **Normalization**: Convert Android sensor format to internal schema
2. **Stability Scoring**: Compute gyroscope jitter to estimate phone mount stability
3. **Z-Score Calculation**: Use MAD (Median Absolute Deviation) for robust z-scores on vertical acceleration
4. **Detection**: Flag samples where z-score > 5.0 and speed > 2 m/s
5. **Debouncing**: Merge detections within 0.7 seconds
6. **Storage**: Save individual detection points to database

### **3. Clustering (On-Demand)**
When frontend requests `/api/v1/clusters`:

1. Fetch all detections from database
2. Run DBSCAN spatial clustering (5m radius, haversine distance)
3. For each cluster, compute:
   - **Hits**: Total detections in cluster
   - **Users**: Unique trip contributors
   - **Intensity**: Average z-score magnitude
   - **Stability**: Average phone stability
   - **Confidence**: Weighted score using coverage, hits, intensity, stability, recency
   - **Priority**: Combination of confidence and intensity-stability product
   - **Likelihood**: Categorical classification (very_likely/likely/uncertain)
4. Return JSON array of clusters

### **4. Visualization (Frontend)**
- Dashboard fetches clusters from API
- Renders as Leaflet markers (color-coded by likelihood)
- Allows filtering by likelihood category
- Dashboard mode shows only top 66th percentile
- Statistics panel shows aggregate metrics
- Data table allows sorting by any metric

---

## **Configuration**

### **Environment Variables (Backend)**

Create a `.env` file in `Ou3a Joura Backend/`:

```env
DATABASE_URL=postgresql://potholes_user:Potato100@db:5432/potholes_db
MAX_BODY_MB=40
```

### **Frontend Configuration**

API URL is configured in `vite.config.ts` and `nginx.conf`:
- Development: Vite proxies `/api/*` to `http://localhost:8000`
- Production: Nginx proxies `/api/*` to backend service

### **Android Configuration**

**Update backend URL before building:**

Edit `MainActivity.kt` (line ~66):
```kotlin
val url = URL("http://YOUR_IP:8000/api/v1/trips")
```

---


**Team Members:**
- Tarek Mourad
- Karim Zarzour
- Karim Hajj Ali



---



## **Future Enhancements**

- [ ] Heat map overlay for intensity visualization
- [ ] Government agency dashboard with export to CSV/Excel
- [ ] iOS app version
- [ ] Machine learning classification (pothole vs speed bump vs manhole)
- [ ] Public API for third-party developers






