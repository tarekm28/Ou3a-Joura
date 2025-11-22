import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Cluster, RoadQualitySegment } from '../services/api';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  clusters: Cluster[];
  roadSegments: RoadQualitySegment[];
  showClusters: boolean;
  showRoadQuality: boolean;
  onClusterClick?: (cluster: Cluster) => void;
  onSegmentClick?: (segment: RoadQualitySegment) => void;
}

export default function MapView({
  clusters,
  roadSegments,
  showClusters,
  showRoadQuality,
  onClusterClick,
  onSegmentClick,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && (clusters.length > 0 || roadSegments.length > 0)) {
      const bounds: L.LatLngBoundsExpression = [];
      
      if (showClusters && clusters.length > 0) {
        clusters.forEach(cluster => {
          if (cluster.latitude && cluster.longitude) {
            bounds.push([cluster.latitude, cluster.longitude]);
          }
        });
      }
      
      if (showRoadQuality && roadSegments.length > 0) {
        roadSegments.forEach(segment => {
          if (segment.latitude && segment.longitude) {
            bounds.push([segment.latitude, segment.longitude]);
          }
        });
      }

      if (bounds.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [clusters, roadSegments, showClusters, showRoadQuality]);

  const getClusterColor = (confidence: number, likelihood?: string) => {
    if (likelihood === 'very_likely') return '#dc2626'; // red-600
    if (likelihood === 'likely') return '#f59e0b'; // amber-500
    return '#6b7280'; // gray-500
  };

  const getRoughnessColor = (roughness: number) => {
    if (roughness > 3) return '#dc2626'; // red-600
    if (roughness > 2) return '#f59e0b'; // amber-500
    return '#eab308'; // yellow-500
  };

  // Default center (you can change this to your region)
  const defaultCenter: [number, number] = [33.8938, 35.5018]; // Beirut, Lebanon

  return (
    <div className="w-full h-full" style={{ minHeight: '600px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', minHeight: '600px' }}
        ref={mapRef}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {showClusters && clusters.map((cluster) => {
          if (!cluster.latitude || !cluster.longitude) return null;
          
          return (
            <CircleMarker
              key={cluster.cluster_id}
              center={[cluster.latitude, cluster.longitude]}
              radius={Math.max(5, Math.min(15, cluster.hits))}
              pathOptions={{
                color: getClusterColor(cluster.confidence, cluster.likelihood),
                fillColor: getClusterColor(cluster.confidence, cluster.likelihood),
                fillOpacity: 0.6,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onClusterClick?.(cluster),
              }}
            >
              <Popup maxWidth={400} className="custom-popup">
                <div className="p-4 min-w-[300px]">
                  <h3 className="font-bold text-lg mb-3 text-gray-900">Pothole Cluster</h3>
                  <div className="space-y-2">
                    <p className="text-base"><strong className="text-gray-700">Confidence:</strong> <span className="text-gray-900">{(cluster.confidence * 100).toFixed(1)}%</span></p>
                    <p className="text-base"><strong className="text-gray-700">Likelihood:</strong> <span className="text-gray-900">{cluster.likelihood || 'N/A'}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Hits:</strong> <span className="text-gray-900">{cluster.hits}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Users:</strong> <span className="text-gray-900">{cluster.users}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Intensity:</strong> <span className="text-gray-900">{cluster.avg_intensity.toFixed(2)}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Priority:</strong> <span className="text-gray-900">{(cluster.priority * 100).toFixed(1)}%</span></p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {showRoadQuality && roadSegments.map((segment) => {
          if (!segment.latitude || !segment.longitude) return null;
          
          return (
            <CircleMarker
              key={segment.segment_id}
              center={[segment.latitude, segment.longitude]}
              radius={8}
              pathOptions={{
                color: getRoughnessColor(segment.roughness),
                fillColor: getRoughnessColor(segment.roughness),
                fillOpacity: 0.5,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onSegmentClick?.(segment),
              }}
            >
              <Popup maxWidth={400} className="custom-popup">
                <div className="p-4 min-w-[300px]">
                  <h3 className="font-bold text-lg mb-3 text-gray-900">Rough Road Segment</h3>
                  <div className="space-y-2">
                    <p className="text-base"><strong className="text-gray-700">Roughness:</strong> <span className="text-gray-900">{segment.roughness.toFixed(2)}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Confidence:</strong> <span className="text-gray-900">{(segment.confidence * 100).toFixed(1)}%</span></p>
                    <p className="text-base"><strong className="text-gray-700">Trips:</strong> <span className="text-gray-900">{segment.trips}</span></p>
                    <p className="text-base"><strong className="text-gray-700">Windows:</strong> <span className="text-gray-900">{segment.rough_windows}</span></p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}


