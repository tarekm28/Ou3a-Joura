import { Filter, SlidersHorizontal, Eye, EyeOff } from 'lucide-react';

interface FiltersProps {
  minConfidence: number;
  onMinConfidenceChange: (value: number) => void;
  showClusters: boolean;
  onShowClustersChange: (value: boolean) => void;
  showRoadQuality: boolean;
  onShowRoadQualityChange: (value: boolean) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function Filters({
  minConfidence,
  onMinConfidenceChange,
  showClusters,
  onShowClustersChange,
  showRoadQuality,
  onShowRoadQualityChange,
  limit,
  onLimitChange,
  onRefresh,
  isLoading,
}: FiltersProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg p-2">
          <SlidersHorizontal className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Filters & Controls</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Confidence Slider */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Min Confidence
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">0%</span>
              <span className="text-lg font-bold text-purple-600">{(minConfidence * 100).toFixed(0)}%</span>
              <span className="text-xs text-gray-500">100%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => onMinConfidenceChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        </div>

        {/* Limit Input */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Result Limit
          </label>
          <input
            type="number"
            min="10"
            max="10000"
            step="100"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value) || 1000)}
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-semibold"
          />
        </div>

        {/* Show Clusters Toggle */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Display Options
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showClusters}
                  onChange={(e) => onShowClustersChange(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-12 h-6 rounded-full transition-all duration-300 ${
                  showClusters ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 mt-0.5 ${
                    showClusters ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showClusters ? (
                  <Eye className="w-5 h-5 text-green-600" />
                ) : (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium text-gray-700">Potholes</span>
              </div>
            </label>
          </div>
        </div>

        {/* Show Road Quality Toggle */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Road Quality
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showRoadQuality}
                  onChange={(e) => onShowRoadQualityChange(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-12 h-6 rounded-full transition-all duration-300 ${
                  showRoadQuality ? 'bg-orange-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 mt-0.5 ${
                    showRoadQuality ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showRoadQuality ? (
                  <Eye className="w-5 h-5 text-orange-600" />
                ) : (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium text-gray-700">Rough Roads</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
        >
          <Filter className="w-5 h-5" />
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>
    </div>
  );
}
