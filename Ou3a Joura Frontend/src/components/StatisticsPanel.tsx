import { Activity, AlertTriangle, MapPin, TrendingUp, Navigation, Zap, Target } from 'lucide-react';
import { Cluster, RoadQualitySegment } from '../services/api';

interface StatisticsPanelProps {
  clusters: Cluster[];
  roadSegments: RoadQualitySegment[];
  isLoading: boolean;
  detailed?: boolean;
}

export default function StatisticsPanel({ clusters, roadSegments, isLoading, detailed = false }: StatisticsPanelProps) {
  if (isLoading) {
    return (
      <div className="stats-loading">
        <div className="stats-loading-skeleton">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card-skeleton">
              <div className="skeleton-line short"></div>
              <div className="skeleton-line long"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalClusters = clusters.length;
  const veryLikelyClusters = clusters.filter(c => c.likelihood === 'very_likely').length;
  const likelyClusters = clusters.filter(c => c.likelihood === 'likely').length;
  const uncertainClusters = clusters.filter(c => !c.likelihood || c.likelihood === 'uncertain').length;
  const totalHits = clusters.reduce((sum, c) => sum + c.hits, 0);
  const totalUsers = new Set(clusters.flatMap(c => Array(c.users).fill(0))).size || 
                     clusters.reduce((sum, c) => sum + c.users, 0);
  const avgConfidence = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.confidence, 0) / clusters.length
    : 0;
  const maxConfidence = clusters.length > 0
    ? Math.max(...clusters.map(c => c.confidence))
    : 0;
  const avgIntensity = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.avg_intensity, 0) / clusters.length
    : 0;

  const totalSegments = roadSegments.length;
  const avgRoughness = roadSegments.length > 0
    ? roadSegments.reduce((sum, s) => sum + s.roughness, 0) / roadSegments.length
    : 0;
  const maxRoughness = roadSegments.length > 0
    ? Math.max(...roadSegments.map(s => s.roughness))
    : 0;
  const totalTrips = roadSegments.reduce((sum, s) => sum + s.trips, 0);
  const totalRoughWindows = roadSegments.reduce((sum, s) => sum + s.rough_windows, 0);

  const stats = [
    {
      label: 'Total Pothole Clusters',
      value: totalClusters,
      icon: MapPin,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
      trend: veryLikelyClusters > 0 ? `⚠️ ${veryLikelyClusters} critical` : 'All clear',
    },
    {
      label: 'Very Likely Potholes',
      value: veryLikelyClusters,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-rose-500',
      bgGradient: 'from-red-50 to-rose-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      trend: `${((veryLikelyClusters / totalClusters) * 100 || 0).toFixed(1)}% of total`,
    },
    {
      label: 'Total Detections',
      value: totalHits,
      icon: Activity,
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      trend: `${totalUsers} unique users`,
    },
    {
      label: 'Avg Confidence',
      value: `${(avgConfidence * 100).toFixed(1)}%`,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-50 to-pink-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200',
      trend: `Max: ${(maxConfidence * 100).toFixed(1)}%`,
    },
    {
      label: 'Rough Road Segments',
      value: totalSegments,
      icon: Navigation,
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-50 to-amber-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200',
      trend: `${totalTrips} trips analyzed`,
    },
    {
      label: 'Avg Roughness',
      value: avgRoughness.toFixed(2),
      icon: Target,
      gradient: 'from-yellow-500 to-lime-500',
      bgGradient: 'from-yellow-50 to-lime-50',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-200',
      trend: `Max: ${maxRoughness.toFixed(2)}`,
    },
  ];

  const detailedStats = [
    {
      label: 'Likely Potholes',
      value: likelyClusters,
      percentage: ((likelyClusters / totalClusters) * 100 || 0).toFixed(1),
    },
    {
      label: 'Uncertain',
      value: uncertainClusters,
      percentage: ((uncertainClusters / totalClusters) * 100 || 0).toFixed(1),
    },
    {
      label: 'Avg Intensity',
      value: avgIntensity.toFixed(2),
      unit: '',
    },
    {
      label: 'Rough Windows',
      value: totalRoughWindows,
      unit: '',
    },
  ];

  return (
    <div className="statistics-panel">
      <div className="statistics-header">
        <div>
          <h3 className="statistics-title">Statistics Overview</h3>
          <p className="statistics-subtitle">Real-time road quality metrics and insights</p>
        </div>
        <div className="statistics-badge">
          <Zap className="w-4 h-4" />
          Live Data
        </div>
      </div>

      <div className="statistics-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`stat-card bg-gradient-to-br ${stat.bgGradient} border ${stat.borderColor}`}
            >
              <div className="stat-card-header">
                <div className={`stat-icon-wrapper bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="stat-card-content">
                  <p className={`stat-label ${stat.textColor}`}>{stat.label}</p>
                  <p className={`stat-value ${stat.textColor}`}>{stat.value}</p>
                  <p className="stat-trend">{stat.trend}</p>
                </div>
              </div>
              <div className="stat-card-footer">
                <div className="stat-progress-bar">
                  <div 
                    className={`stat-progress-fill bg-gradient-to-r ${stat.gradient}`}
                    style={{ 
                      width: typeof stat.value === 'number' 
                        ? `${Math.min((stat.value / (stat.value + 100)) * 100, 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {detailed && (
        <div className="detailed-stats-section">
          <h4 className="detailed-stats-title">Additional Metrics</h4>
          <div className="detailed-stats-grid">
            {detailedStats.map((stat, index) => (
              <div key={index} className="detailed-stat-card">
                <p className="detailed-stat-label">{stat.label}</p>
                <div className="detailed-stat-value-row">
                  <p className="detailed-stat-value">{stat.value}</p>
                  {stat.percentage && (
                    <span className="detailed-stat-percentage">{stat.percentage}%</span>
                  )}
                  {stat.unit && (
                    <span className="detailed-stat-unit">{stat.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribution Chart */}
      {detailed && totalClusters > 0 && (
        <div className="distribution-section">
          <h4 className="distribution-title">Pothole Likelihood Distribution</h4>
          <div className="distribution-chart">
            <div className="distribution-bar-wrapper">
              <div className="distribution-bar-label">Very Likely</div>
              <div className="distribution-bar">
                <div 
                  className="distribution-bar-fill bg-red-500"
                  style={{ width: `${(veryLikelyClusters / totalClusters) * 100}%` }}
                ></div>
                <span className="distribution-bar-value">{veryLikelyClusters}</span>
              </div>
            </div>
            <div className="distribution-bar-wrapper">
              <div className="distribution-bar-label">Likely</div>
              <div className="distribution-bar">
                <div 
                  className="distribution-bar-fill bg-amber-500"
                  style={{ width: `${(likelyClusters / totalClusters) * 100}%` }}
                ></div>
                <span className="distribution-bar-value">{likelyClusters}</span>
              </div>
            </div>
            <div className="distribution-bar-wrapper">
              <div className="distribution-bar-label">Uncertain</div>
              <div className="distribution-bar">
                <div 
                  className="distribution-bar-fill bg-gray-400"
                  style={{ width: `${(uncertainClusters / totalClusters) * 100}%` }}
                ></div>
                <span className="distribution-bar-value">{uncertainClusters}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
