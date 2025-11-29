import { Filter, SlidersHorizontal, Eye, EyeOff, Zap, RotateCcw } from 'lucide-react';
import { useState } from 'react';

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
  compact?: boolean;
}

const confidencePresets = [
  { label: 'All', value: 0.0 },
  { label: 'Low (20%)', value: 0.2 },
  { label: 'Medium (50%)', value: 0.5 },
  { label: 'High (70%)', value: 0.7 },
  { label: 'Very High (90%)', value: 0.9 },
];

const limitPresets = [100, 500, 1000, 2500, 5000];

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
  compact = false,
}: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const handlePresetClick = (value: number) => {
    onMinConfidenceChange(value);
  };

  const handleReset = () => {
    onMinConfidenceChange(0.0);
    onLimitChange(1000);
    onShowClustersChange(true);
    onShowRoadQualityChange(true);
  };

  if (compact) {
    return (
      <div className="filters-compact">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="filters-toggle-btn"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
        {isExpanded && (
          <div className="filters-dropdown">
            <div className="filter-group">
              <label className="filter-label">Min Confidence</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minConfidence}
                onChange={(e) => onMinConfidenceChange(parseFloat(e.target.value))}
                className="filter-slider"
              />
              <div className="filter-value">{(minConfidence * 100).toFixed(0)}%</div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Limit</label>
              <input
                type="number"
                min="10"
                max="10000"
                step="100"
                value={limit}
                onChange={(e) => onLimitChange(parseInt(e.target.value) || 1000)}
                className="filter-input"
              />
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="filter-apply-btn"
            >
              <Zap className="w-4 h-4" />
              Apply
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="filters-container">
      <div className="filters-header">
        <div className="filters-header-left">
          <div className="filters-icon-wrapper">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="filters-title">Filters & Controls</h3>
            <p className="filters-subtitle">Adjust visualization parameters</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="filters-reset-btn"
          title="Reset all filters"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="filters-content">
        {/* Confidence Filter */}
        <div className="filter-section">
          <div className="filter-section-header">
            <label className="filter-section-label">
              <Filter className="w-4 h-4" />
              Minimum Confidence
            </label>
            <span className="filter-section-value">{(minConfidence * 100).toFixed(0)}%</span>
          </div>
          
          <div className="filter-presets">
            {confidencePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={`filter-preset-btn ${minConfidence === preset.value ? 'active' : ''}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConfidence}
            onChange={(e) => onMinConfidenceChange(parseFloat(e.target.value))}
            className="filter-range-slider"
          />
        </div>

        {/* Limit Filter */}
        <div className="filter-section">
          <div className="filter-section-header">
            <label className="filter-section-label">
              <Zap className="w-4 h-4" />
              Result Limit
            </label>
            <span className="filter-section-value">{limit.toLocaleString()}</span>
          </div>

          <div className="filter-presets">
            {limitPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => onLimitChange(preset)}
                className={`filter-preset-btn ${limit === preset ? 'active' : ''}`}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>

          <input
            type="number"
            min="10"
            max="10000"
            step="100"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value) || 1000)}
            className="filter-number-input"
          />
        </div>

        {/* Display Toggles */}
        <div className="filter-section">
          <div className="filter-section-header">
            <label className="filter-section-label">
              <Eye className="w-4 h-4" />
              Display Options
            </label>
          </div>

          <div className="filter-toggles">
            <label className="filter-toggle">
              <div className="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  checked={showClusters}
                  onChange={(e) => onShowClustersChange(e.target.checked)}
                  className="toggle-switch-input"
                />
                <div className={`toggle-switch ${showClusters ? 'active' : ''}`}>
                  <div className="toggle-switch-thumb"></div>
                </div>
              </div>
              <div className="toggle-label-content">
                <div className="toggle-label-main">
                  {showClusters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>Show Pothole Clusters</span>
                </div>
                <span className="toggle-label-sub">Display detected potholes on map</span>
              </div>
            </label>

            <label className="filter-toggle">
              <div className="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  checked={showRoadQuality}
                  onChange={(e) => onShowRoadQualityChange(e.target.checked)}
                  className="toggle-switch-input"
                />
                <div className={`toggle-switch ${showRoadQuality ? 'active' : ''}`}>
                  <div className="toggle-switch-thumb"></div>
                </div>
              </div>
              <div className="toggle-label-content">
                <div className="toggle-label-main">
                  {showRoadQuality ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>Show Road Quality</span>
                </div>
                <span className="toggle-label-sub">Display rough road segments</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="filters-actions">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="filters-apply-btn"
        >
          <Zap className="w-5 h-5" />
          {isLoading ? 'Applying...' : 'Apply Filters'}
        </button>
      </div>
    </div>
  );
}

