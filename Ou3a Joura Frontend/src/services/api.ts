// src/api.ts
export type PotholeLikelihood = "very_likely" | "likely" | "uncertain" | undefined;

export interface PotholeCluster {
  cluster_id: string;
  latitude: number;
  longitude: number;
  hits: number;
  users: number;
  last_ts: string; // ISO string from backend
  avg_intensity: number;
  avg_stability: number;
  exposure: number;
  confidence: number; // 0..1
  priority: number;   // 0..1
  likelihood?: PotholeLikelihood;
  // Local-only UI status (for demo): none / in_progress / fixed
  status?: "none" | "in_progress" | "fixed";
}

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Request failed (${resp.status}): ${text || resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

/**
 * Fetch pothole clusters from backend.
 * - dashboard=true → backend applies its quantile-based threshold (government view)
 * - dashboard=false → raw full set for analysis
 */
export async function fetchClusters(options?: {
  dashboard?: boolean;
  min_conf?: number;
  limit?: number;
  eps_m?: number;
}): Promise<PotholeCluster[]> {
  const { dashboard = false, min_conf, limit = 1000, eps_m } = options || {};

  const url = buildUrl("/api/v1/clusters", {
    dashboard,
    limit,
    ...(min_conf !== undefined ? { min_conf } : {}),
    ...(eps_m !== undefined ? { eps_m } : {}),
  });

  const data = await fetchJson<PotholeCluster[]>(url);

  // Normalize numbers and ensure defaults, in case backend changes slightly
  return data.map((c) => ({
    ...c,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    hits: Number(c.hits),
    users: Number(c.users),
    avg_intensity: Number(c.avg_intensity),
    avg_stability: Number(c.avg_stability),
    exposure: Number(c.exposure ?? c.hits ?? 0),
    confidence: Number(c.confidence),
    priority: Number(c.priority),
    likelihood: c.likelihood as PotholeLikelihood,
    status: "none",
  }));
}
