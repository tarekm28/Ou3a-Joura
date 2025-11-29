// src/components/DataTable.tsx
import { useMemo, useState, useEffect, useRef } from "react";
import { PotholeCluster } from "../services/api";
import { ChevronUp, ChevronDown } from "lucide-react";

interface DataTableProps {
  clusters: PotholeCluster[];
  selectedClusterId: string | null;
  onSelectCluster: (id: string | null) => void;
  onStatusChange: (id: string, status: PotholeCluster["status"]) => void;
  loading: boolean;
}

type SortKey = "id" | "confidence" | "priority" | "hits" | "users" | "likelihood" | "status";

export function DataTable({
  clusters,
  selectedClusterId,
  onSelectCluster,
  onStatusChange,
  loading,
}: DataTableProps) {
  const prevClustersRef = useRef<PotholeCluster[] | null>(null);

  useEffect(() => {
    // Debugging instrumentation: log when clusters prop identity or length changes
    const prev = prevClustersRef.current;
    const sameRef = prev === clusters;
    console.debug("[DataTable] props: clusters.length=", clusters.length, "sameRef=", sameRef, {
      prevCount: prev?.length,
    });
    prevClustersRef.current = clusters;
  }, [clusters]);

  // Deduplicate clusters by cluster_id to avoid React key collisions
  const uniqueClusters = useMemo(() => {
    const seen = new Set<string>();
    const out: PotholeCluster[] = [];
    for (const c of clusters) {
      if (!seen.has(c.cluster_id)) {
        seen.add(c.cluster_id);
        out.push(c);
      }
    }
    if (out.length !== clusters.length) {
      const dupCount = clusters.length - out.length;
      const sampleDup = clusters
        .map((c) => c.cluster_id)
        .filter((id, idx, arr) => arr.indexOf(id) !== idx)
        .slice(0, 6);
      console.warn(`[DataTable] removed ${dupCount} duplicate clusters before render`, sampleDup);
    }
    return out;
  }, [clusters]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = uniqueClusters;
    
    // Search filter (on top of already-filtered clusters from App.tsx)
    if (q) {
      result = result.filter((c) =>
        c.cluster_id.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortKey) {
        case "id":
          aVal = a.cluster_id;
          bVal = b.cluster_id;
          break;
        case "confidence":
            aVal = Number.isFinite(a.confidence) ? a.confidence : Number.NEGATIVE_INFINITY;
            bVal = Number.isFinite(b.confidence) ? b.confidence : Number.NEGATIVE_INFINITY;
          break;
        case "priority":
            aVal = Number.isFinite(a.priority) ? a.priority : Number.NEGATIVE_INFINITY;
            bVal = Number.isFinite(b.priority) ? b.priority : Number.NEGATIVE_INFINITY;
          break;
        case "hits":
          aVal = a.hits;
          bVal = b.hits;
          break;
        case "users":
          aVal = a.users;
          bVal = b.users;
          break;
        case "likelihood":
          const order = { very_likely: 3, likely: 2, uncertain: 1, undefined: 0 };
          aVal = order[a.likelihood as keyof typeof order] ?? 0;
          bVal = order[b.likelihood as keyof typeof order] ?? 0;
          break;
        case "status":
          const statusOrder = { fixed: 3, in_progress: 2, none: 1 };
          aVal = statusOrder[a.status as keyof typeof statusOrder] ?? 0;
          bVal = statusOrder[b.status as keyof typeof statusOrder] ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });

    // Debug: show a small sample of cluster ids to help trace staleness
    const sample = sorted.slice(0, 6).map((x) => x.cluster_id);
    console.debug("[DataTable] compute filtered =>", sorted.length, sample);
    return sorted;
  }, [uniqueClusters, search, sortKey, sortDesc]);

  useEffect(() => {
    // Log whenever the memoized filtered result changes
    console.debug("[DataTable] filtered changed: length=", filtered.length, "search=", search, "sort=", sortKey, sortDesc);
  }, [filtered, search, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="w-4" />;
    return sortDesc ? (
      <ChevronDown className="w-3 h-3 inline" />
    ) : (
      <ChevronUp className="w-3 h-3 inline" />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Pothole list</h2>
          <p className="text-[11px] text-slate-400">
            {filtered.length} clusters in current filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-[10px] text-slate-400 animate-pulse">
              Loading…
            </span>
          )}
          <input
            type="text"
            placeholder="Search by cluster id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] w-40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto text-[11px]">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="border-b border-slate-800 text-slate-400">
              <th 
                className="px-2 py-1 text-left cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("id")}
              >
                ID <SortIcon column="id" />
              </th>
              <th 
                className="px-2 py-1 text-right cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("confidence")}
              >
                Conf. <SortIcon column="confidence" />
              </th>
              <th 
                className="px-2 py-1 text-right cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("priority")}
              >
                Priority <SortIcon column="priority" />
              </th>
              <th 
                className="px-2 py-1 text-right cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("hits")}
              >
                Hits <SortIcon column="hits" />
              </th>
              <th 
                className="px-2 py-1 text-right cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("users")}
              >
                Users <SortIcon column="users" />
              </th>
              <th 
                className="px-2 py-1 text-left cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("likelihood")}
              >
                Likelihood <SortIcon column="likelihood" />
              </th>
              <th 
                className="px-2 py-1 text-left cursor-pointer hover:text-slate-300"
                onClick={() => toggleSort("status")}
              >
                Status <SortIcon column="status" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const selected = c.cluster_id === selectedClusterId;
              return (
                <tr
                  key={c.cluster_id}
                  className={`border-b border-slate-800/60 cursor-pointer ${
                    selected ? "bg-slate-800/80" : "hover:bg-slate-800/40"
                  }`}
                  onClick={() =>
                    onSelectCluster(
                      selected ? null : c.cluster_id
                    )
                  }
                >
                  <td 
                    className="px-2 py-1 font-mono text-[10px] text-slate-300 cursor-pointer hover:text-emerald-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCluster(c.cluster_id);
                    }}
                  >
                    {c.cluster_id.slice(3, 11)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {Number.isFinite(c.confidence) ? c.confidence.toFixed(3) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {Number.isFinite(c.priority) ? c.priority.toFixed(3) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{c.hits}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{c.users}</td>
                  <td className="px-2 py-1 text-left">
                    {c.likelihood ?? "—"}
                  </td>
                  <td
                    className="px-2 py-1 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px]"
                      value={c.status ?? "none"}
                      onChange={(e) =>
                        onStatusChange(
                          c.cluster_id,
                          e.target.value as PotholeCluster["status"]
                        )
                      }
                    >
                      <option value="none">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-2 py-4 text-center text-slate-500"
                >
                  No clusters match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
