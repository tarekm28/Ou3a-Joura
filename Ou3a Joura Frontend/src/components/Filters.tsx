// src/components/Filters.tsx
import { PotholeLikelihood } from "../services/api";

export interface FiltersState {
  minConfidence: number; // 0..1
  minHits: number;
  likelihoods: ("very_likely" | "likely" | "uncertain")[];
  status: "all" | "none" | "in_progress" | "fixed";
}

interface FiltersProps {
  filters: FiltersState;
  onChange: (f: FiltersState) => void;
  viewMode: "dashboard" | "all";
  maxHits?: number;
}

const LIKELIHOOD_LABELS: Record<"very_likely" | "likely" | "uncertain", string> = {
  very_likely: "Very likely",
  likely: "Likely",
  uncertain: "Uncertain",
};

export function Filters({ filters, onChange, viewMode, maxHits = 20 }: FiltersProps) {
  function toggleLikelihood(l: PotholeLikelihood) {
    if (!l) return;
    const set = new Set(filters.likelihoods);
    if (set.has(l)) set.delete(l);
    else set.add(l);
    onChange({ ...filters, likelihoods: Array.from(set) as FiltersState["likelihoods"] });
  }

  function handleReset() {
    onChange({
      minConfidence: 0,
      minHits: 0,
      likelihoods: [],
      status: "all",
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        <button
          onClick={handleReset}
          className="text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
        >
          Reset
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        View mode:{" "}
        <span className="font-medium text-emerald-400">
          {viewMode === "dashboard" ? "High-priority subset" : "All clustered potholes"}
        </span>
      </p>

      {/* Confidence */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-300 flex justify-between">
          <span>Minimum confidence</span>
          <span className="tabular-nums text-slate-400">
            {Math.round(filters.minConfidence * 100)}%
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.minConfidence}
          onChange={(e) =>
            onChange({
              ...filters,
              minConfidence: Number(e.target.value),
            })
          }
        />
      </div>

      {/* Hits */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-300 flex justify-between">
          <span>Minimum hits</span>
          <span className="tabular-nums text-slate-400">{filters.minHits}</span>
        </label>
        <input
          type="range"
          min={0}
          max={maxHits}
          step={1}
          value={filters.minHits}
          onChange={(e) =>
            onChange({
              ...filters,
              minHits: Number(e.target.value),
            })
          }
        />
      </div>

      {/* Likelihood */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-slate-300 mb-1">Likelihood buckets</p>
        <div className="flex flex-wrap gap-1">
          {(["very_likely", "likely", "uncertain"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLikelihood(l)}
              className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                filters.likelihoods.includes(l)
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-400/60"
              }`}
            >
              {LIKELIHOOD_LABELS[l]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          Leave all off to include every likelihood.
        </p>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-slate-300 mb-1">Maintenance status</p>
        <select
          className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px]"
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as FiltersState["status"],
            })
          }
        >
          <option value="all">All</option>
          <option value="none">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>
    </section>
  );
}
