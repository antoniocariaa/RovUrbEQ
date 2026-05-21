"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import ZoneLayer from "./ZoneLayer";

// ── Fix Leaflet's broken default icon in Next.js/webpack ─────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Layer catalogue (pure data, no Leaflet) ──────────────────────────────────
import type { LayerConfig } from "@/lib/layers";
import { LAYERS } from "@/lib/layers";
export type { LayerConfig } from "@/lib/layers";
export { LAYERS } from "@/lib/layers";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GeoPoint {
  id: string;
  dbId: string;
  name: string;
  lat: number;
  lng: number;
  layerId: string;
  address?: string;
  phone?: string;
  website?: string;
}


// ── Global fetch cache — persists across re-renders / layer toggles ───────────
const _cache = new Map<string, GeoPoint[]>();

async function fetchLayer(layer: LayerConfig, signal: AbortSignal): Promise<GeoPoint[]> {
  // Return cached result immediately — no network round-trip
  if (_cache.has(layer.id)) return _cache.get(layer.id)!;

  // Fetch from the Next.js API Route which queries MongoDB server-side
  const res = await fetch(`/api/locations?layerId=${layer.id}`, { signal });
  if (!res.ok) {
    console.error(`[LeafletMap] Failed to fetch layer "${layer.id}":`, res.status);
    return [];
  }

  const points: GeoPoint[] = await res.json();
  _cache.set(layer.id, points);
  return points;
}

// ── Custom icon factory (cached per layer) ────────────────────────────────────
const _iconCache = new Map<string, L.DivIcon>();
function getIcon(layer: LayerConfig): L.DivIcon {
  if (_iconCache.has(layer.id)) return _iconCache.get(layer.id)!;
  const icon = new L.DivIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:${layer.color};border:2px solid ${layer.borderColor};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 0 ${layer.borderColor};"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -22],
  });
  _iconCache.set(layer.id, icon);
  return icon;
}

// ── Popup HTML builder ────────────────────────────────────────────────────────
function buildPopupHTML(point: GeoPoint, layer: LayerConfig): string {
  const addr = point.address ? `<p style="font-size:10px;color:#6b7280;margin:2px 0">📍 ${point.address}</p>` : "";
  const phone = point.phone ? `<p style="font-size:10px;color:#6b7280;margin:2px 0">📞 ${point.phone}</p>` : "";
  const web = point.website
    ? `<a href="${point.website}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:${layer.color};display:block;margin-top:4px">🔗 Sito web</a>`
    : "";
  return `
    <div style="font-family:'Inter',system-ui,sans-serif;min-width:190px;max-width:250px;padding:12px 14px;background:#fff;border:2.5px solid ${layer.borderColor};border-radius:12px;box-shadow:4px 4px 0 ${layer.borderColor};">
      <div style="display:inline-flex;align-items:center;gap:4px;background:${layer.color}22;border:1.5px solid ${layer.color};border-radius:6px;padding:2px 8px;margin-bottom:6px;">
        <span style="font-size:11px">${layer.emoji}</span>
        <span style="font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${layer.borderColor}">${layer.label}</span>
      </div>
      <p style="font-size:13px;font-weight:800;color:#1e1b4b;line-height:1.35;margin:0 0 6px">${point.name}</p>
      ${addr}${phone}${web}
      <p style="font-size:9px;color:#9ca3af;margin-top:6px;border-top:1px solid #f3f4f6;padding-top:4px">${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</p>
      <!-- Hidden delete functionality
      <button 
        onclick="if(confirm('Sei sicuro di voler eliminare questo punto?')) window.dispatchEvent(new CustomEvent('delete-location', { detail: { dbId: '${point.dbId}', layerId: '${layer.id}' } }))"
        style="margin-top: 8px; width: 100%; padding: 6px 0; background: #fee2e2; color: #991b1b; border: 1.5px solid #991b1b; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; transition: all 0.2s;"
        onmouseover="this.style.background='#fecaca'"
        onmouseout="this.style.background='#fee2e2'"
      >
        🗑️ Elimina punto
      </button>
      -->
    </div>`;
}

// ── Cluster layer config ───────────────────────────────────────────────────────
function makeClusterGroup(): L.MarkerClusterGroup {
  return (L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup }).markerClusterGroup({
    chunkedLoading: true,        // adds markers in chunks to avoid blocking UI thread
    chunkInterval: 100,          // ms between chunks
    chunkDelay: 50,              // ms delay after each chunk
    maxClusterRadius: 60,        // px — how close markers must be to cluster
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    removeOutsideVisibleBounds: true, // critical: removes off-screen markers from DOM
    iconCreateFunction: (cluster: L.MarkerCluster) => {
      const count = cluster.getChildCount();
      const size = count < 10 ? 32 : count < 50 ? 40 : 48;
      return new L.DivIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;background:#6366f1;border:2.5px solid #1e1b4b;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:3px 3px 0 #1e1b4b;font-family:Inter,system-ui,sans-serif;font-weight:900;font-size:${size < 40 ? 12 : 14}px;color:#fff;">${count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    },
  });
}

// ── Imperative cluster layer manager ─────────────────────────────────────────
// Bypasses React reconciliation entirely — Leaflet manages the DOM directly.
interface ClusterLayerProps {
  activeLayers: string[];
  onCountChange: (n: number) => void;
  onLoadingChange: (loading: boolean) => void;
}

function ClusterLayer({ activeLayers, onCountChange, onLoadingChange }: ClusterLayerProps) {
  const map = useMap();
  // One cluster group per layer id so we can add/remove independently
  const groupsRef = useRef<Map<string, L.MarkerClusterGroup>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const layerById = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

  const syncLayers = useCallback(async () => {
    // Cancel any in-flight fetches from previous call
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const activeSet = new Set(activeLayers);

    // ── Remove layers that are no longer active ────────────────────────────
    for (const [id, group] of groupsRef.current) {
      if (!activeSet.has(id)) {
        map.removeLayer(group);
        groupsRef.current.delete(id);
      }
    }

    // ── Determine which layers still need to be fetched/added ──────────────
    const toLoad = activeLayers.filter((id) => !groupsRef.current.has(id));

    if (toLoad.length === 0) {
      // Re-compute total count from existing groups
      let total = 0;
      for (const g of groupsRef.current.values()) total += g.getLayers().length;
      onCountChange(total);
      return;
    }

    onLoadingChange(true);

    try {
      // Fetch all new layers in parallel (cache hits are instant)
      const results = await Promise.all(
        toLoad.map((id) => fetchLayer(layerById[id], ctrl.signal))
      );

      if (ctrl.signal.aborted) return;

      // Add each new layer to the map
      toLoad.forEach((id, i) => {
        const points = results[i];
        if (points.length === 0) return;

        const layer = layerById[id];
        const icon = getIcon(layer);
        const group = makeClusterGroup();

        const markers = points.map((pt) => {
          const m = L.marker([pt.lat, pt.lng], { icon });
          m.bindPopup(buildPopupHTML(pt, layer), {
            closeButton: false,
            className: "urban-popup",
            maxWidth: 260,
          });
          return m;
        });

        group.addLayers(markers); // bulk add — much faster than addLayer loop
        map.addLayer(group);
        groupsRef.current.set(id, group);
      });

      // Final count
      let total = 0;
      for (const g of groupsRef.current.values()) total += g.getLayers().length;
      onCountChange(total);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") console.error(err);
    } finally {
      if (!ctrl.signal.aborted) onLoadingChange(false);
    }
  }, [activeLayers, map, onCountChange, onLoadingChange, layerById]);

  useEffect(() => {
    syncLayers();
    return () => { abortRef.current?.abort(); };
  }, [syncLayers]);

  // Handle delete events
  useEffect(() => {
    const handleDelete = async (e: Event) => {
      const { dbId, layerId } = (e as CustomEvent).detail;
      onLoadingChange(true);
      try {
        const res = await fetch(`/api/locations/${dbId}`, { method: 'DELETE' });
        if (res.ok) {
          // Invalidate cache
          _cache.delete(layerId);
          // Remove from map to trigger a fresh re-fetch
          const group = groupsRef.current.get(layerId);
          if (group) {
            map.removeLayer(group);
            groupsRef.current.delete(layerId);
          }
          syncLayers();
        } else {
          alert("Errore durante l'eliminazione del punto.");
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert("Errore di rete durante l'eliminazione.");
      } finally {
        onLoadingChange(false);
      }
    };

    window.addEventListener('delete-location', handleDelete);
    return () => window.removeEventListener('delete-location', handleDelete);
  }, [syncLayers, map, onLoadingChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const g of groupsRef.current.values()) map.removeLayer(g);
      groupsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null; // renders nothing — all DOM managed by Leaflet imperatively
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface LeafletMapProps {
  activeLayers: string[];
  showZones?: boolean;
  onCountChange?: (n: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  onZoneClick?: (zoneName: string) => void;
}

const ROVERETO: [number, number] = [45.8904, 11.0401];

// ── Main export ───────────────────────────────────────────────────────────────
export default function LeafletMap({ activeLayers, showZones = false, onCountChange, onLoadingChange, onZoneClick }: LeafletMapProps) {
  // Define bounding box for Rovereto to lock the map view (with wider margins)
  const ROVERETO_BOUNDS: L.LatLngBoundsExpression = [
    [45.7, 10.8], // South-West
    [46.1, 11.3], // North-East
  ];

  return (
    <MapContainer
      center={ROVERETO}
      zoom={14}
      minZoom={11}
      className="h-full w-full"
      preferCanvas={true}   // use Canvas renderer — far faster for many markers
      maxBounds={ROVERETO_BOUNDS}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <ZoneLayer showZones={showZones} onZoneClick={onZoneClick} />
      <ClusterLayer
        activeLayers={activeLayers}
        onCountChange={onCountChange ?? (() => {})}
        onLoadingChange={onLoadingChange ?? (() => {})}
      />
    </MapContainer>
  );
}
