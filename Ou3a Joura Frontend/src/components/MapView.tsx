// src/components/MapView.tsx
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import * as L from "leaflet";
import { PotholeCluster } from "../services/api";

interface MapViewProps {
  clusters: PotholeCluster[];
  selectedClusterId: string | null;
  onSelectCluster: (id: string | null) => void;
}

const LEBANON_CENTER: [number, number] = [33.8547, 35.8623];

function colorForCluster(c: PotholeCluster): string {
  if (c.status === "fixed") return "#22c55e"; // green
  if (c.status === "in_progress") return "#eab308"; // yellow
  if (c.likelihood === "very_likely") return "#ef4444"; // red
  if (c.likelihood === "likely") return "#fb923c"; // orange
  return "#38bdf8"; // cyan for uncertain
}

function radiusForCluster(c: PotholeCluster): number {
  const base = 6;
  const intensityBoost = Math.min(c.avg_intensity / 4, 3);
  const hitsBoost = Math.min(c.hits / 5, 3);
  return base + intensityBoost + hitsBoost;
}

function MapManager({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: MapViewProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }

    // Clear existing markers
    layerRef.current.clearLayers();

    // Add current clusters
    clusters.forEach((c) => {
      if (!isFinite(c.latitude) || !isFinite(c.longitude)) return;
      const color = colorForCluster(c);
      const radius = radiusForCluster(c);

      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: c.cluster_id === selectedClusterId ? 0.9 : 0.5,
        weight: c.cluster_id === selectedClusterId ? 2.5 : 1.2,
      });

      const popupContent = `
        <div style="font-size:12px">
          <div style="font-weight:600">Pothole cluster</div>
          <div>Confidence: ${c.confidence.toFixed(3)}</div>
          <div>Priority: ${c.priority.toFixed(3)}</div>
          <div>Intensity: ${c.avg_intensity.toFixed(2)}</div>
          <div>Hits: ${c.hits}</div>
          <div>Users: ${c.users}</div>
          <div>Likelihood: ${c.likelihood ?? "n/a"}</div>
          ${c.status ? `<div>Status: ${c.status}</div>` : ""}
        </div>
      `;

      marker.bindTooltip(popupContent, { direction: "top", sticky: true });
      marker.on("click", () => onSelectCluster(c.cluster_id));
      marker.addTo(layerRef.current!);
    });

    // Update highlight when selectedClusterId changes by re-applying styles
    return () => {
      // leave cleanup to next effect call
    };
  }, [clusters, selectedClusterId, map, onSelectCluster]);

  // When a cluster is selected, fly to it and zoom in a bit
  useEffect(() => {
    if (!selectedClusterId) return;
    const c = clusters.find((x) => x.cluster_id === selectedClusterId);
    if (!c) return;
    if (!isFinite(c.latitude) || !isFinite(c.longitude)) return;

    try {
      const target = L.latLng(c.latitude, c.longitude);
      const currentZoom = (map as any).getZoom ? (map as any).getZoom() : 12;
      const targetZoom = Math.max(currentZoom, 15);
      map.flyTo(target, targetZoom, { duration: 0.6 });
    } catch (err) {
      // ignore map errors
    }
  }, [selectedClusterId, clusters, map]);

  // Keep map instance rendered; MapContainer handles view
  return null;
}

export function MapView({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: MapViewProps) {
  return (
    <MapContainer
      center={LEBANON_CENTER}
      zoom={12}
      minZoom={8}
      maxZoom={18}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapManager
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        onSelectCluster={onSelectCluster}
      />
    </MapContainer>
  );
}
