// src/components/StatisticsPanel.tsx
import { useMemo } from "react";
import { PotholeCluster } from "../services/api";

interface StatisticsPanelProps {
  clusters: PotholeCluster[];
  filteredClusters: PotholeCluster[];
  viewMode: "dashboard" | "all";
  loading: boolean;
  error: string | null;
}

export function StatisticsPanel({
  clusters,
  filteredClusters,
  viewMode,
  loading,
  error,
}: StatisticsPanelProps) {
  // Deduplicate clusters by cluster_id (same logic as DataTable)
  const uniqueClusters = useMemo(() => {
    const seen = new Set<string>();
    const out: PotholeCluster[] = [];
    for (const c of clusters) {
      if (!seen.has(c.cluster_id)) {
        seen.add(c.cluster_id);
        out.push(c);
      }
    }
    return out;
  }, [clusters]);

  const uniqueFiltered = useMemo(() => {
    const seen = new Set<string>();
    const out: PotholeCluster[] = [];
    for (const c of filteredClusters) {
      if (!seen.has(c.cluster_id)) {
        seen.add(c.cluster_id);
        out.push(c);
      }
    }
    return out;
  }, [filteredClusters]);

  // In dashboard mode, "total" should be the filtered set (no uncertain)
  // In all mode, "total" is everything
  const total = viewMode === "dashboard" ? uniqueFiltered.length : uniqueClusters.length;
  const visible = uniqueFiltered.length;

  const byLikelihood = {
    very_likely: uniqueFiltered.filter((c) => c.likelihood === "very_likely").length,
    likely: uniqueFiltered.filter((c) => c.likelihood === "likely").length,
    uncertain: uniqueFiltered.filter((c) => c.likelihood === "uncertain" || !c.likelihood)
      .length,
  };

  const avgConf =
    uniqueClusters.length === 0
      ? 0
      : uniqueClusters.reduce((sum, c) => sum + c.confidence, 0) / uniqueClusters.length;

  const avgPriority =
    uniqueClusters.length === 0
      ? 0
      : uniqueClusters.reduce((sum, c) => sum + c.priority, 0) / uniqueClusters.length;



  const fixed = uniqueClusters.filter((c) => c.status === "fixed").length;
  const inProgress = uniqueClusters.filter((c) => c.status === "in_progress").length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Summary</h2>
        {loading && (
          <span className="text-[11px] text-slate-400 animate-pulse">
            Updating…
          </span>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800 rounded-md px-2 py-1">
          Backend error: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
          <div className="text-slate-400">Clusters ({viewMode})</div>
          <div className="mt-1 text-sm font-semibold">
            {visible} <span className="text-slate-500 text-[10px]">visible</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Out of {total} total in this view
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
          <div className="text-slate-400">Global confidence</div>
          <div className="mt-1 text-sm font-semibold">
            {avgConf.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">
            Priority: {avgPriority.toFixed(3)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
          <div className="text-slate-400">Likelihood breakdown</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />
              Very likely: {byLikelihood.very_likely}
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
              Likely: {byLikelihood.likely}
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />
              Uncertain: {byLikelihood.uncertain}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
          <div className="text-slate-400">Maintenance status</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />
              Fixed: {fixed}
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
              In progress: {inProgress}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
