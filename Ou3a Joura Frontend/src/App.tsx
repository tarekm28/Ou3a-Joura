// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { fetchClusters, PotholeCluster } from "./services/api";
import { MapView } from "./components/MapView";
import { Filters, FiltersState } from "./components/Filters";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { DataTable } from "./components/DataTable";
import { ErrorBoundary } from "./components/ErrorBoundary";

type ViewMode = "dashboard" | "all";

function applyFilters(
  clusters: PotholeCluster[],
  filters: FiltersState,
  viewMode: ViewMode
): PotholeCluster[] {
  return clusters.filter((c) => {
    // In dashboard mode, automatically filter out uncertain clusters
    if (viewMode === "dashboard") {
      const likelihood = c.likelihood || "uncertain";
      if (likelihood === "uncertain") {
        return false;
      }
    }
    
    if (filters.minConfidence > 0 && c.confidence < filters.minConfidence) {
      return false;
    }
    if (filters.minHits > 0 && c.hits < filters.minHits) {
      return false;
    }
    if (filters.likelihoods.length > 0) {
      // If likelihoods are selected, cluster's likelihood must be in the selected list
      const clusterLikelihood = c.likelihood || "uncertain";
      if (!filters.likelihoods.includes(clusterLikelihood)) {
        return false;
      }
    }
    if (filters.status !== "all" && c.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");

  const [clustersDashboard, setClustersDashboard] = useState<PotholeCluster[]>([]);
  const [clustersAll, setClustersAll] = useState<PotholeCluster[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FiltersState>({
    minConfidence: 0,
    minHits: 0,
    likelihoods: [],
    status: "all",
  });

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const activeClusters = viewMode === "dashboard" ? clustersDashboard : clustersAll;

  // Fetch function
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dash, all] = await Promise.all([
        fetchClusters({ dashboard: true, limit: 5000 }),
        fetchClusters({ dashboard: false, limit: 5000 }),
      ]);

      // Default status: none
      const initStatus = (list: PotholeCluster[]) =>
        list.map((c) => ({ ...c, status: c.status ?? "none" as const }));

      setClustersDashboard(initStatus(dash));
      setClustersAll(initStatus(all));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Restore status from localStorage (demo: gov marking potholes as fixed)
  useEffect(() => {
    const stored = localStorage.getItem("ouaa_cluster_status");
    if (!stored) return;
    try {
      const statusMap: Record<string, PotholeCluster["status"]> = JSON.parse(stored);
      const applyStatus = (list: PotholeCluster[]) =>
        list.map((c) => ({
          ...c,
          status: statusMap[c.cluster_id] ?? c.status ?? "none",
        }));
      setClustersDashboard((prev) => applyStatus(prev));
      setClustersAll((prev) => applyStatus(prev));
    } catch {
      // ignore
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Calculate max hits from all clusters for dynamic slider range
  const maxHits = useMemo(() => {
    const allClusters = [...clustersDashboard, ...clustersAll];
    if (allClusters.length === 0) return 20;
    const maxValue = Math.max(...allClusters.map((c) => c.hits));
    // Round up to nearest 100
    return Math.ceil(maxValue / 100) * 100;
  }, [clustersDashboard, clustersAll]);

  // Derived: filtered clusters
  const filteredClusters = useMemo(
    () => applyFilters(activeClusters, filters, viewMode),
    [activeClusters, filters, viewMode]
  );



  function handleStatusChange(id: string, status: PotholeCluster["status"]) {
    const updateList = (list: PotholeCluster[]) =>
      list.map((c) => (c.cluster_id === id ? { ...c, status } : c));

    setClustersDashboard((prev) => updateList(prev));
    setClustersAll((prev) => updateList(prev));

    // persist in localStorage (demo: pretend gov changed status)
    const currentStatus: Record<string, PotholeCluster["status"]> = {};
    [...clustersDashboard, ...clustersAll].forEach((c) => {
      currentStatus[c.cluster_id] = c.status ?? "none";
    });
    currentStatus[id] = status;
    localStorage.setItem("ouaa_cluster_status", JSON.stringify(currentStatus));
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Top bar */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-slate-900 shadow-lg shadow-emerald-500/40">
                OJ
              </div>
              <div>
                <h1 className="text-lg font-semibold">Ou3a Joura! – Government Dashboard</h1>
                <p className="text-xs text-slate-400">
                  Data-driven pothole prioritization for Lebanese roads
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {loading && (
                <span className="text-[11px] text-slate-400 animate-pulse">Loading data...</span>
              )}
              <button
                className={`px-3 py-1 rounded-full text-xs border ${
                  viewMode === "dashboard"
                    ? "bg-emerald-500 text-slate-900 border-emerald-400"
                    : "bg-slate-900 text-slate-200 border-slate-700"
                }`}
                onClick={() => setViewMode("dashboard")}
              >
                High-priority view
              </button>
              <button
                className={`px-3 py-1 rounded-full text-xs border ${
                  viewMode === "all"
                    ? "bg-emerald-500 text-slate-900 border-emerald-400"
                    : "bg-slate-900 text-slate-200 border-slate-700"
                }`}
                onClick={() => setViewMode("all")}
              >
                All detections
              </button>
            </div>
          </div>
        </header>

        {/* Main grid */}
        <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-4 grid grid-cols-1 xl:grid-cols-[260px,minmax(0,1fr)] gap-4">
          {/* Left: Filters + stats */}
          <div className="flex flex-col gap-4">
            <Filters
              filters={filters}
              onChange={setFilters}
              viewMode={viewMode}
              maxHits={maxHits}
            />
            <StatisticsPanel
              clusters={activeClusters}
              filteredClusters={filteredClusters}
              viewMode={viewMode}
              loading={loading}
              error={error}
            />
          </div>

          {/* Right: Map + table */}
          {error ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl border border-rose-800 bg-rose-950/30">
              <div className="max-w-md text-center px-6 py-8">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-rose-200 mb-2">Connection Error</h3>
                <p className="text-sm text-rose-100/70 mb-4">{error}</p>
                <p className="text-xs text-rose-100/50 mb-4">
                  Make sure the backend API is running on <code className="bg-slate-900 px-2 py-1 rounded">http://localhost:8000</code>
                </p>
                <button
                  onClick={() => {
                    setError(null);
                    // Retry fetch
                    setTimeout(() => {
                      loadData();
                    }, 500);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <p className="text-slate-300">Loading pothole data...</p>
              </div>
            </div>
          ) : activeClusters.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="text-center">
                <div className="text-4xl mb-4">🛣️</div>
                <p className="text-slate-300 mb-2">No clusters loaded yet</p>
                <p className="text-sm text-slate-500">
                  {viewMode === "dashboard"
                    ? "Switch to 'All detections' for more data"
                    : "No pothole clusters found in the backend"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 min-h-[70vh]">
              <div className="flex-1 min-h-[320px] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <MapView
                  clusters={filteredClusters}
                  selectedClusterId={selectedClusterId}
                  onSelectCluster={setSelectedClusterId}
                />
              </div>

              <div className="h-[280px] rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <DataTable
                  clusters={filteredClusters}
                  selectedClusterId={selectedClusterId}
                  onSelectCluster={setSelectedClusterId}
                  onStatusChange={handleStatusChange}
                  loading={loading}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
