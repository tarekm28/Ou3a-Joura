import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Cluster, RoadQualitySegment } from '../services/api';
import { AlertCircle, Navigation, Info, TrendingUp, Users, Zap } from 'lucide-react';

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
  isPreview?: boolean;
}

// Component to handle map bounds
function MapBounds({ clusters, roadSegments, showClusters, showRoadQuality }: {
  clusters: Cluster[];
  roadSegments: RoadQualitySegment[];
  showClusters: boolean;
  showRoadQuality: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if ((clusters.length > 0 || roadSegments.length > 0) && !map.getBounds().isValid()) {
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
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [clusters, roadSegments, showClusters, showRoadQuality, map]);

  return null;
}

export default function MapView({
  clusters,
  roadSegments,
  showClusters,
  showRoadQuality,
  onClusterClick,
  onSegmentClick,
  isPreview = false,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [, setSelectedCluster] = useState<Cluster | null>(null);
  const [, setSelectedSegment] = useState<RoadQualitySegment | null>(null);

  const getClusterColor = (_confidence: number, likelihood?: string) => {
    if (likelihood === 'very_likely') return '#dc2626'; // red-600
    if (likelihood === 'likely') return '#f59e0b'; // amber-500
    return '#6b7280'; // gray-500
  };

  const getRoughnessColor = (roughness: number) => {
    if (roughness > 3) return '#dc2626'; // red-600
    if (roughness > 2) return '#f59e0b'; // amber-500
    return '#eab308'; // yellow-500
  };

  const getClusterSize = (hits: number) => {
    return Math.max(6, Math.min(20, hits * 0.5));
  };

  // Default center (Beirut, Lebanon)
  const defaultCenter: [number, number] = [33.8938, 35.5018];
  const defaultZoom = isPreview ? 12 : 13;

  const handleClusterClick = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setSelectedSegment(null);
    onClusterClick?.(cluster);
  };

  const handleSegmentClick = (segment: RoadQualitySegment) => {
    setSelectedSegment(segment);
    setSelectedCluster(null);
    onSegmentClick?.(segment);
  };

  return (
    <div className="w-full h-full" style={{ minHeight: isPreview ? '400px' : '600px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', minHeight: isPreview ? '400px' : '600px' }}
        ref={mapRef}
        scrollWheelZoom={!isPreview}
        doubleClickZoom={!isPreview}
        zoomControl={!isPreview}
        dragging={!isPreview}
        touchZoom={!isPreview}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds 
          clusters={clusters} 
          roadSegments={roadSegments}
          showClusters={showClusters}
          showRoadQuality={showRoadQuality}
        />
        
        {showClusters && clusters.map((cluster) => {
          if (!cluster.latitude || !cluster.longitude) return null;
          
          const color = getClusterColor(cluster.confidence, cluster.likelihood);
          const size = getClusterSize(cluster.hits);
          
          return (
            <CircleMarker
              key={cluster.cluster_id}
              center={[cluster.latitude, cluster.longitude]}
              radius={size}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: cluster.likelihood === 'very_likely' ? 0.7 : 0.5,
                weight: cluster.likelihood === 'very_likely' ? 3 : 2,
              }}
              eventHandlers={{
                click: () => handleClusterClick(cluster),
              }}
            >
              <Popup maxWidth={400} className="custom-popup">
                <div className="popup-content">
                  <div className="popup-header">
                    <div className="popup-icon-wrapper" style={{ background: `${color}20`, color: color }}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="popup-title">Pothole Cluster</h3>
                      <p className="popup-subtitle">Detection #{cluster.cluster_id.substring(0, 8)}</p>
                    </div>
                  </div>
                  
                  <div className="popup-stats-grid">
                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <TrendingUp className="w-4 h-4" />
                        Confidence
                      </div>
                      <div className="popup-stat-value">
                        {(cluster.confidence * 100).toFixed(1)}%
                      </div>
                      <div className="popup-stat-bar">
                        <div 
                          className="popup-stat-bar-fill"
                          style={{ 
                            width: `${cluster.confidence * 100}%`,
                            background: color
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <AlertCircle className="w-4 h-4" />
                        Likelihood
                      </div>
                      <div className={`popup-stat-badge popup-stat-badge-${cluster.likelihood || 'uncertain'}`}>
                        {cluster.likelihood || 'uncertain'}
                      </div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <Zap className="w-4 h-4" />
                        Hits
                      </div>
                      <div className="popup-stat-value">{cluster.hits}</div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <Users className="w-4 h-4" />
                        Users
                      </div>
                      <div className="popup-stat-value">{cluster.users}</div>
                    </div>
                  </div>

                  <div className="popup-details">
                    <div className="popup-detail-row">
                      <span className="popup-detail-label">Intensity:</span>
                      <span className="popup-detail-value">{cluster.avg_intensity.toFixed(2)}</span>
                    </div>
                    <div className="popup-detail-row">
                      <span className="popup-detail-label">Priority:</span>
                      <span className="popup-detail-value">{(cluster.priority * 100).toFixed(1)}%</span>
                    </div>
                    <div className="popup-detail-row">
                      <span className="popup-detail-label">Location:</span>
                      <span className="popup-detail-value font-mono text-xs">
                        {cluster.latitude.toFixed(6)}, {cluster.longitude.toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {showRoadQuality && roadSegments.map((segment) => {
          if (!segment.latitude || !segment.longitude) return null;
          
          const color = getRoughnessColor(segment.roughness);
          
          return (
            <CircleMarker
              key={segment.segment_id}
              center={[segment.latitude, segment.longitude]}
              radius={8}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.5,
                weight: 2,
              }}
              eventHandlers={{
                click: () => handleSegmentClick(segment),
              }}
            >
              <Popup maxWidth={400} className="custom-popup">
                <div className="popup-content">
                  <div className="popup-header">
                    <div className="popup-icon-wrapper" style={{ background: `${color}20`, color: color }}>
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="popup-title">Rough Road Segment</h3>
                      <p className="popup-subtitle">Segment #{segment.segment_id.substring(0, 8)}</p>
                    </div>
                  </div>
                  
                  <div className="popup-stats-grid">
                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <TrendingUp className="w-4 h-4" />
                        Roughness
                      </div>
                      <div className="popup-stat-value">
                        {segment.roughness.toFixed(2)}
                      </div>
                      <div className="popup-stat-bar">
                        <div 
                          className="popup-stat-bar-fill"
                          style={{ 
                            width: `${Math.min(segment.roughness * 20, 100)}%`,
                            background: color
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <Info className="w-4 h-4" />
                        Confidence
                      </div>
                      <div className="popup-stat-value">
                        {(segment.confidence * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <Navigation className="w-4 h-4" />
                        Trips
                      </div>
                      <div className="popup-stat-value">{segment.trips}</div>
                    </div>

                    <div className="popup-stat">
                      <div className="popup-stat-label">
                        <Zap className="w-4 h-4" />
                        Windows
                      </div>
                      <div className="popup-stat-value">{segment.rough_windows}</div>
                    </div>
                  </div>

                  <div className="popup-details">
                    <div className="popup-detail-row">
                      <span className="popup-detail-label">Location:</span>
                      <span className="popup-detail-value font-mono text-xs">
                        {segment.latitude.toFixed(6)}, {segment.longitude.toFixed(6)}
                      </span>
                    </div>
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
