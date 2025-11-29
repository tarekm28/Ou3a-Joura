import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Cluster {
  cluster_id: string;
  latitude: number;
  longitude: number;
  hits: number;
  users: number;
  last_ts: string;
  avg_intensity: number;
  avg_stability: number;
  exposure: number;
  confidence: number;
  priority: number;
  likelihood?: 'very_likely' | 'likely' | 'uncertain';
}

export interface RoadQualitySegment {
  segment_id: string;
  latitude: number;
  longitude: number;
  roughness: number;
  rough_windows: number;
  trips: number;
  last_ts: string;
  confidence: number;
}

export interface HealthStatus {
  status: string;
}

export const apiService = {
  async getHealth(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>('/api/v1/health');
    return response.data;
  },

  async getClusters(params: {
    min_conf?: number;
    limit?: number;
    dashboard?: boolean;
    eps_m?: number;
  } = {}): Promise<Cluster[]> {
    const response = await api.get<Cluster[]>('/api/v1/clusters', { params });
    return response.data;
  },

  async getRoadQuality(params: {
    min_conf?: number;
    limit?: number;
  } = {}): Promise<RoadQualitySegment[]> {
    const response = await api.get<RoadQualitySegment[]>('/api/v1/road_quality', { params });
    return response.data;
  },
};


