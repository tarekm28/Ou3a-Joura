# Ou3a Joura Frontend

A React-based dashboard for visualizing pothole detection and road quality data from the Ou3a Joura backend.

## Features

- 🗺️ **Interactive Map View** - Visualize pothole clusters and rough road segments on an interactive map
- 📊 **Statistics Dashboard** - Real-time statistics and metrics
- 📋 **Data Tables** - Sortable and filterable tables for clusters and road quality segments
- 🎛️ **Filters** - Adjustable confidence thresholds and display options
- 🔄 **Real-time Updates** - Refresh data from the backend API

## Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running on `http://localhost:8000` (or configure via environment variable)

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Configuration

You can configure the backend API URL by setting the `VITE_API_URL` environment variable:

```bash
VITE_API_URL=http://your-backend-url:8000 npm run dev
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Leaflet** - Map visualization
- **Axios** - HTTP client
- **Lucide React** - Icons

## Project Structure

```
src/
  ├── components/
  │   ├── MapView.tsx          # Map visualization component
  │   ├── StatisticsPanel.tsx  # Statistics cards
  │   ├── DataTable.tsx        # Sortable data tables
  │   └── Filters.tsx          # Filter controls
  ├── services/
  │   └── api.ts               # API service layer
  ├── App.tsx                  # Main app component
  ├── main.tsx                 # Entry point
  └── index.css                # Global styles
```

## API Endpoints Used

- `GET /api/v1/health` - Health check
- `GET /api/v1/clusters` - Get pothole clusters
- `GET /api/v1/road_quality` - Get road quality segments


