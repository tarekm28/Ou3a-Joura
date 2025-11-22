import { Activity, AlertTriangle, MapPin, TrendingUp, Road, Users } from 'lucide-react';
import { Cluster, RoadQualitySegment } from '../services/api';

interface StatisticsPanelProps {
  clusters: Cluster[];
  roadSegments: RoadQualitySegment[];
  isLoading: boolean;
}

export default function StatisticsPanel({ clusters, roadSegments, isLoading }: StatisticsPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const totalClusters = clusters.length;
  const veryLikelyClusters = clusters.filter(c => c.likelihood === 'very_likely').length;
  const likelyClusters = clusters.filter(c => c.likelihood === 'likely').length;
  const totalHits = clusters.reduce((sum, c) => sum + c.hits, 0);
  const totalUsers = new Set(clusters.flatMap(c => Array(c.users).fill(0))).size || 
                     clusters.reduce((sum, c) => sum + c.users, 0);
  const avgConfidence = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.confidence, 0) / clusters.length
    : 0;

  const totalSegments = roadSegments.length;
  const avgRoughness = roadSegments.length > 0
    ? roadSegments.reduce((sum, s) => sum + s.roughness, 0) / roadSegments.length
    : 0;
  const totalTrips = roadSegments.reduce((sum, s) => sum + s.trips, 0);

  const stats = [
    {
      label: 'Total Pothole Clusters',
      value: totalClusters,
      icon: MapPin,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      textColor: 'text-blue-700',
    },
    {
      label: 'Very Likely Potholes',
      value: veryLikelyClusters,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-rose-500',
      bgGradient: 'from-red-50 to-rose-50',
      textColor: 'text-red-700',
    },
    {
      label: 'Total Detections',
      value: totalHits,
      icon: Activity,
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      textColor: 'text-green-700',
    },
    {
      label: 'Avg Confidence',
      value: `${(avgConfidence * 100).toFixed(1)}%`,
      icon: TrendingUp,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-50 to-pink-50',
      textColor: 'text-purple-700',
    },
    {
      label: 'Rough Road Segments',
      value: totalSegments,
      icon: Road,
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-50 to-amber-50',
      textColor: 'text-orange-700',
    },
    {
      label: 'Avg Roughness',
      value: avgRoughness.toFixed(2),
      icon: TrendingUp,
      gradient: 'from-yellow-500 to-lime-500',
      bgGradient: 'from-yellow-50 to-lime-50',
      textColor: 'text-yellow-700',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.bgGradient} rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50 backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className={`text-sm font-medium ${stat.textColor} mb-2`}>{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
                </div>
                <div className={`bg-gradient-to-br ${stat.gradient} rounded-lg p-3 shadow-md`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
