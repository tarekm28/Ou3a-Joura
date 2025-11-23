import { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Map, Table, BarChart3, Settings, 
  Menu, X, Zap, TrendingUp, AlertCircle, 
  Layers, Download, Home
} from 'lucide-react';
import { apiService, Cluster, RoadQualitySegment } from './services/api';
import MapView from './components/MapView';
import StatisticsPanel from './components/StatisticsPanel';
import DataTable from './components/DataTable';
import Filters from './components/Filters';
import './App.css';

type ViewMode = 'dashboard' | 'map' | 'clusters' | 'roadQuality' | 'analytics';

function App() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [roadSegments, setRoadSegments] = useState<RoadQualitySegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [limit, setLimit] = useState(1000);
  const [showClusters, setShowClusters] = useState(true);
  const [showRoadQuality, setShowRoadQuality] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clustersData, roadQualityData] = await Promise.all([
        apiService.getClusters({ min_conf: minConfidence, limit }),
        apiService.getRoadQuality({ min_conf: minConfidence, limit }),
      ]);
      setClusters(clustersData);
      setRoadSegments(roadQualityData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [minConfidence, limit]);

  useEffect(() => {
    // Initial fetch with error handling
    fetchData().catch(err => {
      console.error('Initial data fetch failed:', err);
      setError('Unable to connect to backend API. Please ensure the backend is running on http://localhost:8000');
      setIsLoading(false);
    });
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData().catch(err => console.error('Auto-refresh failed:', err));
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Add error handling for API failures
  useEffect(() => {
    if (error) {
      console.error('App error:', error);
    }
  }, [error]);

  const navigationItems = [
    { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: Home, color: 'from-blue-500 to-cyan-500' },
    { id: 'map' as ViewMode, label: 'Map View', icon: Map, color: 'from-green-500 to-emerald-500' },
    { id: 'clusters' as ViewMode, label: 'Pothole Clusters', icon: AlertCircle, color: 'from-red-500 to-rose-500' },
    { id: 'roadQuality' as ViewMode, label: 'Road Quality', icon: Layers, color: 'from-orange-500 to-amber-500' },
    { id: 'analytics' as ViewMode, label: 'Analytics', icon: BarChart3, color: 'from-purple-500 to-pink-500' },
  ];

  const quickStats = {
    totalClusters: clusters.length,
    veryLikely: clusters.filter(c => c.likelihood === 'very_likely').length,
    totalHits: clusters.reduce((sum, c) => sum + c.hits, 0),
    avgConfidence: clusters.length > 0
      ? (clusters.reduce((sum, c) => sum + c.confidence, 0) / clusters.length * 100).toFixed(1)
      : '0.0',
    totalSegments: roadSegments.length,
    avgRoughness: roadSegments.length > 0
      ? (roadSegments.reduce((sum, s) => sum + s.roughness, 0) / roadSegments.length).toFixed(2)
      : '0.00',
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="menu-toggle"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="logo-section">
              <div className="logo-icon">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="app-title">Ou3a Joura</h1>
                <p className="app-subtitle">Smart Road Quality Detection</p>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            <div className="status-indicator">
              <div className={`status-dot ${isLoading ? 'loading' : 'active'}`}></div>
              <span className="status-text">
                {isLoading ? 'Loading...' : `Updated ${lastUpdate.toLocaleTimeString()}`}
              </span>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="refresh-btn"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'spinning' : ''}`} />
            </button>
            {viewMode === 'map' && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="settings-btn"
                title="Toggle filters"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar Navigation */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setViewMode(item.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <div className={`nav-icon-wrapper bg-gradient-to-br ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="nav-label">{item.label}</span>
                  {isActive && <div className="nav-indicator"></div>}
                </button>
              );
            })}
          </nav>

          {/* Quick Stats in Sidebar */}
          {viewMode === 'dashboard' && (
            <div className="sidebar-stats">
              <h3 className="sidebar-stats-title">Quick Overview</h3>
              <div className="quick-stats-grid">
                <div className="quick-stat-card">
                  <div className="quick-stat-icon bg-blue-100 text-blue-600">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="quick-stat-value">{quickStats.totalClusters}</p>
                    <p className="quick-stat-label">Clusters</p>
                  </div>
                </div>
                <div className="quick-stat-card">
                  <div className="quick-stat-icon bg-red-100 text-red-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="quick-stat-value">{quickStats.veryLikely}</p>
                    <p className="quick-stat-label">Critical</p>
                  </div>
                </div>
                <div className="quick-stat-card">
                  <div className="quick-stat-icon bg-green-100 text-green-600">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="quick-stat-value">{quickStats.totalSegments}</p>
                    <p className="quick-stat-label">Segments</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters Panel in Sidebar for Map View */}
          {viewMode === 'map' && sidebarOpen && (
            <div className="sidebar-filters">
              <Filters
                minConfidence={minConfidence}
                onMinConfidenceChange={setMinConfidence}
                showClusters={showClusters}
                onShowClustersChange={setShowClusters}
                showRoadQuality={showRoadQuality}
                onShowRoadQualityChange={setShowRoadQuality}
                limit={limit}
                onLimitChange={setLimit}
                onRefresh={fetchData}
                isLoading={isLoading}
              />
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {/* Error Banner */}
          {error && (
            <div className="error-banner">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="error-title">Connection Error</p>
                <p className="error-message">{error}</p>
              </div>
              <button onClick={fetchData} className="error-retry-btn">
                Retry
              </button>
            </div>
          )}

          {/* Dashboard View */}
          {viewMode === 'dashboard' && (
            <div className="dashboard-view">
              <div className="dashboard-header">
                <div>
                  <h2 className="dashboard-title">Road Quality Dashboard</h2>
                  <p className="dashboard-subtitle">Real-time pothole detection and road quality analysis</p>
                </div>
                <div className="dashboard-actions">
                  <button className="action-btn secondary">
                    <Download className="w-4 h-4" />
                    Export Data
                  </button>
                  <button className="action-btn primary" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'spinning' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              <StatisticsPanel
                clusters={clusters}
                roadSegments={roadSegments}
                isLoading={isLoading}
              />

              <div className="dashboard-grid">
                <div className="dashboard-card map-preview">
                  <div className="card-header">
                    <Map className="w-5 h-5" />
                    <h3>Interactive Map</h3>
                    <button 
                      onClick={() => setViewMode('map')}
                      className="card-action-btn"
                    >
                      View Full Map →
                    </button>
                  </div>
                  <div className="map-preview-container">
                    <MapView
                      clusters={clusters}
                      roadSegments={roadSegments}
                      showClusters={showClusters}
                      showRoadQuality={showRoadQuality}
                      isPreview={true}
                    />
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="card-header">
                    <Table className="w-5 h-5" />
                    <h3>Recent Clusters</h3>
                  </div>
                  <div className="recent-clusters">
                    {clusters.slice(0, 5).map((cluster) => (
                      <div key={cluster.cluster_id} className="recent-cluster-item">
                        <div className="cluster-badge" data-likelihood={cluster.likelihood || 'uncertain'}>
                          {cluster.likelihood || 'uncertain'}
                        </div>
                        <div className="cluster-info">
                          <p className="cluster-confidence">
                            {(cluster.confidence * 100).toFixed(1)}% confidence
                          </p>
                          <p className="cluster-details">
                            {cluster.hits} hits • {cluster.users} users
                          </p>
                        </div>
                      </div>
                    ))}
                    {clusters.length === 0 && !isLoading && (
                      <p className="empty-state">No clusters found</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map View */}
          {viewMode === 'map' && (
            <div className="map-view-container">
              <div className="map-header">
                <h2 className="view-title">Interactive Map</h2>
                <div className="map-controls">
                  <button
                    className={`control-btn ${showClusters ? 'active' : ''}`}
                    onClick={() => setShowClusters(!showClusters)}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Potholes
                  </button>
                  <button
                    className={`control-btn ${showRoadQuality ? 'active' : ''}`}
                    onClick={() => setShowRoadQuality(!showRoadQuality)}
                  >
                    <Layers className="w-4 h-4" />
                    Road Quality
                  </button>
                </div>
              </div>
              <div className="map-wrapper">
                <MapView
                  clusters={clusters}
                  roadSegments={roadSegments}
                  showClusters={showClusters}
                  showRoadQuality={showRoadQuality}
                />
              </div>
            </div>
          )}

          {/* Clusters Table View */}
          {viewMode === 'clusters' && (
            <div className="table-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Pothole Clusters</h2>
                  <p className="view-subtitle">
                    {clusters.length} clusters detected • {quickStats.veryLikely} require immediate attention
                  </p>
                </div>
                <div className="view-actions">
                  <Filters
                    minConfidence={minConfidence}
                    onMinConfidenceChange={setMinConfidence}
                    showClusters={showClusters}
                    onShowClustersChange={setShowClusters}
                    showRoadQuality={showRoadQuality}
                    onShowRoadQualityChange={setShowRoadQuality}
                    limit={limit}
                    onLimitChange={setLimit}
                    onRefresh={fetchData}
                    isLoading={isLoading}
                    compact={true}
                  />
                </div>
              </div>
              <DataTable clusters={clusters} type="clusters" />
            </div>
          )}

          {/* Road Quality Table View */}
          {viewMode === 'roadQuality' && (
            <div className="table-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Road Quality Segments</h2>
                  <p className="view-subtitle">
                    {roadSegments.length} segments analyzed • Average roughness: {quickStats.avgRoughness}
                  </p>
                </div>
                <div className="view-actions">
                  <Filters
                    minConfidence={minConfidence}
                    onMinConfidenceChange={setMinConfidence}
                    showClusters={showClusters}
                    onShowClustersChange={setShowClusters}
                    showRoadQuality={showRoadQuality}
                    onShowRoadQualityChange={setShowRoadQuality}
                    limit={limit}
                    onLimitChange={setLimit}
                    onRefresh={fetchData}
                    isLoading={isLoading}
                    compact={true}
                  />
                </div>
              </div>
              <DataTable roadSegments={roadSegments} type="roadQuality" />
            </div>
          )}

          {/* Analytics View */}
          {viewMode === 'analytics' && (
            <div className="analytics-view">
              <div className="view-header">
                <h2 className="view-title">Analytics & Insights</h2>
                <p className="view-subtitle">Detailed analysis of road quality data</p>
              </div>
              <StatisticsPanel
                clusters={clusters}
                roadSegments={roadSegments}
                isLoading={isLoading}
                detailed={true}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
