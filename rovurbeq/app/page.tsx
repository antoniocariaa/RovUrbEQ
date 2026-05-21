"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { LAYERS, type LayerConfig } from "@/lib/layers";
import AiChat from "@/components/chat/AiChat";

// ── Dynamic import with ssr:false ─────────────────────────────────────────────
const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-indigo-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <p className="text-sm font-bold tracking-widest text-indigo-400 uppercase">
        Caricamento mappa…
      </p>
    </div>
  ),
});

// ── Layer toggle button ───────────────────────────────────────────────────────
function LayerToggle({
  layer,
  active,
  onToggle,
}: {
  layer: LayerConfig;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-150 active:scale-95"
      style={{
        borderColor: active ? layer.borderColor : "#d1d5db",
        background: active ? layer.color + "18" : "#f9fafb",
        boxShadow: active ? `3px 3px 0 ${layer.borderColor}` : "2px 2px 0 #d1d5db",
      }}
    >
      {/* Colour dot */}
      <span
        className="flex-shrink-0 h-3 w-3 rounded-full border-2"
        style={{
          background: active ? layer.color : "#e5e7eb",
          borderColor: active ? layer.borderColor : "#9ca3af",
        }}
      />
      <span className="text-sm">{layer.emoji}</span>
      <span
        className="flex-1 text-xs font-bold"
        style={{ color: active ? layer.borderColor : "#6b7280" }}
      >
        {layer.label}
      </span>
      {/* Checkmark */}
      {active && (
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3 8l3.5 3.5L13 4"
            stroke={layer.borderColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Ragazzi", ids: ["asili", "scuole"] },
  { label: "Salute", ids: ["farmacie", "rsa", "cura"] },
  { label: "Servizi", ids: ["poste", "biblioteche", "alimentari"] },
  { label: "Comunità", ids: ["campi", "parchi"] },
  { label: "Mobilità", ids: ["bus", "parking", "bici"] },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeLayers, setActiveLayers] = useState<string[]>(["asili"]);
  const [showZones, setShowZones] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  function toggleLayer(id: string) {
    setActiveLayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setActiveLayers((prev) =>
      prev.length === LAYERS.length ? [] : LAYERS.map((l) => l.id)
    );
  }

  // Stable callbacks — won't cause LeafletMap to re-render
  const handleCount = useCallback((n: number) => setPointCount(n), []);
  const handleLoading = useCallback((v: boolean) => setIsLoading(v), []);

  const layerById = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
  const allActive = activeLayers.length === LAYERS.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f4ff] font-sans">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-shrink-0 items-center justify-between border-b-2 border-indigo-900 bg-white px-6 py-3 shadow-[0_3px_0_#1e1b4b]">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-indigo-900 bg-indigo-600 shadow-[3px_3px_0_#1e1b4b]">
            <span className="text-xl">🏙️</span>
          </div>
          <div className="leading-none">
            <h1 className="text-lg font-extrabold tracking-tight text-indigo-900">
              Urban Equity
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
              Rovereto — Hackathon PoC
            </p>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 bg-indigo-50 px-4 py-2 shadow-[3px_3px_0_#1e1b4b]">
            <span className="text-base">{isLoading ? "⏳" : "🗂️"}</span>
            <div className="leading-tight">
              <span className="block text-sm font-extrabold text-indigo-900">
                {activeLayers.length}/{LAYERS.length}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                Layer attivi
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 bg-indigo-50 px-4 py-2 shadow-[3px_3px_0_#1e1b4b]">
            <span className="text-base">📌</span>
            <div className="leading-tight">
              <span className="block text-sm font-extrabold text-indigo-900">
                {isLoading ? "…" : pointCount.toLocaleString("it-IT")}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                Punti mappa
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 bg-indigo-50 px-4 py-2 shadow-[3px_3px_0_#1e1b4b]">
            <span className="text-base">📍</span>
            <div className="leading-tight">
              <span className="block text-sm font-extrabold text-indigo-900">Rovereto</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                Comune TN
              </span>
            </div>
          </div>
        </div>

        {/* Hackathon badge */}
        <div className="rounded-xl border-2 border-emerald-700 bg-emerald-50 px-4 py-1.5 shadow-[3px_3px_0_#14532d]">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
            ✦ Hackathon 2026
          </span>
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-[3px_3px_0_#1e1b4b] transition-colors"
          style={{
            background: chatOpen ? "#6366f1" : "#f0f0ff",
            color: chatOpen ? "#fff" : "#3730a3",
          }}
        >
          🤖 {chatOpen ? "Chiudi Chat" : "AI Chat"}
        </button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r-2 border-indigo-900 bg-white p-3">
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            Layer dati
          </p>

          {/* Select all toggle */}
          <button
            onClick={toggleAll}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-indigo-900 py-2 text-xs font-extrabold uppercase tracking-wider shadow-[3px_3px_0_#1e1b4b] transition-colors"
            style={{
              background: allActive ? "#6366f1" : "#f0f0ff",
              color: allActive ? "#fff" : "#3730a3",
            }}
          >
            {allActive ? "✕ Deseleziona tutti" : "✓ Seleziona tutti"}
          </button>

          {/* Layer groups */}
          <div className="mb-2">
            <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-gray-400">
              Quartieri
            </p>
            <button
              onClick={() => setShowZones((z) => !z)}
              className="flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-left transition-all duration-150 active:scale-95"
              style={{
                borderColor: showZones ? "#3730a3" : "#d1d5db",
                background: showZones ? "#e0e7ff" : "#f9fafb",
                boxShadow: showZones ? `3px 3px 0 #3730a3` : "2px 2px 0 #d1d5db",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">🗺️</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: showZones ? "#3730a3" : "#6b7280" }}
                >
                  Zone Voronoi
                </span>
              </div>
              {showZones && (
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8l3.5 3.5L13 4"
                    stroke="#3730a3"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>

          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                {cat.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {cat.ids.map((id) => {
                  const layer = layerById[id];
                  if (!layer) return null;
                  return (
                    <LayerToggle
                      key={id}
                      layer={layer}
                      active={activeLayers.includes(id)}
                      onToggle={() => toggleLayer(id)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer note */}
          <div className="mt-auto rounded-xl border-2 border-gray-200 bg-gray-50 p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
              Fonte dati
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
              OpenStreetMap / Overpass Turbo
            </p>
            <p className="text-[9px] text-gray-400">© ODbL Contributors</p>
          </div>
        </aside>

        {/* ── Map area ────────────────────────────────────────────────────── */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {/* Top strip */}
          <div className="flex flex-shrink-0 items-center gap-2 border-b-2 border-indigo-900 bg-white px-4 py-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Live map — Rovereto (45.8904°N, 11.0401°E) · OpenStreetMap Dati © ODbL
            </span>
          </div>

          {/* Map */}
          <div className="relative m-4 flex-1 overflow-hidden rounded-2xl border-2 border-indigo-900 shadow-[6px_6px_0_#1e1b4b]">
            <LeafletMap
              activeLayers={activeLayers}
              showZones={showZones}
              onCountChange={handleCount}
              onLoadingChange={handleLoading}
            />
          </div>
        </main>

        {/* ── Chat panel ──────────────────────────────────────────────────── */}
        <aside
          className={`chat-panel flex-shrink-0 border-l-2 border-indigo-900 ${
            chatOpen ? "chat-panel-open w-96" : "chat-panel-closed"
          }`}
        >
          {chatOpen && <AiChat />}
        </aside>
      </div>
    </div>
  );
}
