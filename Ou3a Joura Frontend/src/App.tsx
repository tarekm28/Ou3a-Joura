import { useState, useEffect } from 'react';
import { RefreshCw, Map, Table, BarChart3, Settings } from 'lucide-react';
import { apiService, Cluster, RoadQualitySegment } from './services/api';
import MapView from './components/MapView';
import StatisticsPanel from './components/StatisticsPanel';
import DataTable from './components/DataTable';
import Filters from './components/Filters';

function App() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [roadSegments, setRoadSegments] = useState<RoadQualitySegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [limit, setLimit] = useState(1000);
  const [showClusters, setShowClusters] = useState(true);
  const [showRoadQuality, setShowRoadQuality] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'clusters' | 'roadQuality'>('map');
  const [showFilters, setShowFilters] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clustersData, roadQualityData] = await Promise.all([
        apiService.getClusters({ min_conf: minConfidence, limit }),
        apiService.getRoadQuality({ min_conf: minConfidence, limit }),
      ]);
      setClusters(clustersData);
      setRoadSegments(roadQualityData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [minConfidence, limit]);

  const tabs = [
    { id: 'map', label: 'Map View', icon: Map },
    { id: 'clusters', label: 'Pothole Clusters', icon: Table },
    { id: 'roadQuality', label: 'Road Quality', icon: BarChart3 },
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Modern Header with Gradient */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <Map className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Ou3a Joura</h1>
                <p className="text-sm text-blue-100">Pothole Detection & Road Quality Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              {activeTab === 'map' && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-200"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex">
        {/* Sidebar Navigation - Only for non-map views */}
        {activeTab !== 'map' && (
          <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <StatisticsPanel
                clusters={clusters}
                roadSegments={roadSegments}
                isLoading={isLoading}
              />
            </div>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs - Only show on map view */}
          {activeTab === 'map' && (
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
              <div className="px-4 sm:px-6 lg:px-8">
                <nav className="flex space-x-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all duration-200 ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Filters Panel - Collapsible for map view */}
          {activeTab === 'map' && showFilters && (
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm p-4">
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

          {/* Statistics - Only for non-map views */}
          {activeTab !== 'map' && (
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6">
              <StatisticsPanel
                clusters={clusters}
                roadSegments={roadSegments}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Filters - Only for non-map views */}
          {activeTab !== 'map' && (
            <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6">
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

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 bg-red-50 border-l-4 border-red-400 text-red-800 px-4 py-3 rounded-r-lg shadow-md">
              <p className="font-medium">Error: {error}</p>
              <p className="text-sm mt-1">Make sure the backend is running on http://localhost:8000</p>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'map' && (
              <div className="h-full bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-200">
                <MapView
                  clusters={clusters}
                  roadSegments={roadSegments}
                  showClusters={showClusters}
                  showRoadQuality={showRoadQuality}
                />
              </div>
            )}

            {activeTab === 'clusters' && (
              <div className="h-full overflow-auto bg-white rounded-xl shadow-xl">
                <DataTable clusters={clusters} type="clusters" />
              </div>
            )}

            {activeTab === 'roadQuality' && (
              <div className="h-full overflow-auto bg-white rounded-xl shadow-xl">
                <DataTable roadSegments={roadSegments} type="roadQuality" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
