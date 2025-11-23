import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, MapPin, ExternalLink } from 'lucide-react';
import { Cluster, RoadQualitySegment } from '../services/api';

interface DataTableProps {
  clusters?: Cluster[];
  roadSegments?: RoadQualitySegment[];
  type: 'clusters' | 'roadQuality';
}

export default function DataTable({ clusters = [], roadSegments = [], type }: DataTableProps) {
  const [sortField, setSortField] = useState<string>('confidence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = useState('');
  const [selectedLikelihood, setSelectedLikelihood] = useState<string>('all');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getLikelihoodColor = (likelihood?: string) => {
    switch (likelihood) {
      case 'very_likely':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'likely':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoughnessColor = (roughness: number) => {
    if (roughness > 3) return 'text-red-600';
    if (roughness > 2) return 'text-amber-600';
    return 'text-yellow-600';
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (type === 'clusters') {
    const filtered = useMemo(() => {
      return clusters.filter(c => {
        const searchText = filterText.toLowerCase();
        const matchesSearch = 
          c.cluster_id.toLowerCase().includes(searchText) ||
          (c.likelihood && c.likelihood.toLowerCase().includes(searchText));
        const matchesLikelihood = selectedLikelihood === 'all' || c.likelihood === selectedLikelihood;
        return matchesSearch && matchesLikelihood;
      });
    }, [clusters, filterText, selectedLikelihood]);

    const sorted = useMemo(() => {
      return [...filtered].sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }, [filtered, sortField, sortDirection]);

    const likelihoodCounts = useMemo(() => {
      const counts: Record<string, number> = { all: clusters.length };
      clusters.forEach(c => {
        const key = c.likelihood || 'uncertain';
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }, [clusters]);

    return (
      <div className="data-table-container">
        <div className="data-table-header">
          <div>
            <h3 className="data-table-title">Pothole Clusters</h3>
            <p className="data-table-subtitle">
              {sorted.length} of {clusters.length} clusters shown
            </p>
          </div>
          <div className="data-table-controls">
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search clusters..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-buttons">
              {['all', 'very_likely', 'likely', 'uncertain'].map((likelihood) => (
                <button
                  key={likelihood}
                  onClick={() => setSelectedLikelihood(likelihood)}
                  className={`filter-btn ${selectedLikelihood === likelihood ? 'active' : ''}`}
                >
                  {likelihood === 'all' ? 'All' : likelihood.replace('_', ' ')}
                  {likelihoodCounts[likelihood] !== undefined && (
                    <span className="filter-count">{likelihoodCounts[likelihood]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('cluster_id')} className="sortable">
                  <div className="th-content">
                    ID
                    {sortField === 'cluster_id' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('confidence')} className="sortable">
                  <div className="th-content">
                    Confidence
                    {sortField === 'confidence' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('likelihood')} className="sortable">
                  <div className="th-content">
                    Likelihood
                    {sortField === 'likelihood' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('hits')} className="sortable">
                  <div className="th-content">
                    Hits
                    {sortField === 'hits' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('users')} className="sortable">
                  <div className="th-content">
                    Users
                    {sortField === 'users' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('avg_intensity')} className="sortable">
                  <div className="th-content">
                    Intensity
                    {sortField === 'avg_intensity' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cluster) => (
                <tr key={cluster.cluster_id} className="table-row">
                  <td>
                    <span className="cluster-id">{cluster.cluster_id.substring(0, 12)}...</span>
                  </td>
                  <td>
                    <div className="confidence-cell">
                      <span className="confidence-value">{(cluster.confidence * 100).toFixed(1)}%</span>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${cluster.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`likelihood-badge ${getLikelihoodColor(cluster.likelihood)}`}>
                      {cluster.likelihood || 'uncertain'}
                    </span>
                  </td>
                  <td className="numeric-cell">{cluster.hits}</td>
                  <td className="numeric-cell">{cluster.users}</td>
                  <td className="numeric-cell">{cluster.avg_intensity.toFixed(2)}</td>
                  <td>
                    <div className="location-cell">
                      <MapPin className="w-4 h-4" />
                      <span className="location-coords">
                        {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => openInMaps(cluster.latitude, cluster.longitude)}
                      className="action-button"
                      title="Open in Google Maps"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="empty-state">
              <Search className="w-12 h-12 text-gray-400" />
              <p className="empty-state-text">No clusters found</p>
              <p className="empty-state-subtext">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Road Quality table
  const filtered = useMemo(() => {
    return roadSegments.filter(s => {
      const searchText = filterText.toLowerCase();
      return s.segment_id.toLowerCase().includes(searchText);
    });
  }, [roadSegments, filterText]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortDirection]);

  return (
    <div className="data-table-container">
      <div className="data-table-header">
        <div>
          <h3 className="data-table-title">Road Quality Segments</h3>
          <p className="data-table-subtitle">
            {sorted.length} of {roadSegments.length} segments shown
          </p>
        </div>
        <div className="data-table-controls">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search segments..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('segment_id')} className="sortable">
                <div className="th-content">
                  ID
                  {sortField === 'segment_id' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('roughness')} className="sortable">
                <div className="th-content">
                  Roughness
                  {sortField === 'roughness' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('confidence')} className="sortable">
                <div className="th-content">
                  Confidence
                  {sortField === 'confidence' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('trips')} className="sortable">
                <div className="th-content">
                  Trips
                  {sortField === 'trips' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th onClick={() => handleSort('rough_windows')} className="sortable">
                <div className="th-content">
                  Windows
                  {sortField === 'rough_windows' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((segment) => (
              <tr key={segment.segment_id} className="table-row">
                <td>
                  <span className="cluster-id">{segment.segment_id.substring(0, 12)}...</span>
                </td>
                <td>
                  <div className="confidence-cell">
                    <span className={`confidence-value ${getRoughnessColor(segment.roughness)}`}>
                      {segment.roughness.toFixed(2)}
                    </span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill bg-orange-500"
                        style={{ width: `${Math.min(segment.roughness * 20, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="confidence-cell">
                    <span className="confidence-value">{(segment.confidence * 100).toFixed(1)}%</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill bg-orange-500"
                        style={{ width: `${segment.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="numeric-cell">{segment.trips}</td>
                <td className="numeric-cell">{segment.rough_windows}</td>
                <td>
                  <div className="location-cell">
                    <MapPin className="w-4 h-4" />
                    <span className="location-coords">
                      {segment.latitude.toFixed(4)}, {segment.longitude.toFixed(4)}
                    </span>
                  </div>
                </td>
                <td>
                  <button
                    onClick={() => openInMaps(segment.latitude, segment.longitude)}
                    className="action-button"
                    title="Open in Google Maps"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="empty-state">
            <Search className="w-12 h-12 text-gray-400" />
            <p className="empty-state-text">No road quality segments found</p>
            <p className="empty-state-subtext">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
