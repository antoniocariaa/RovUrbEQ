"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { LAYERS, type LayerConfig } from "@/lib/layers";
import AiChat from "@/components/chat/AiChat";
import ZoneDetailPanel from "@/components/equity/ZoneDetailPanel";

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
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

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
  const handleZoneClick = useCallback((name: string) => setSelectedZone(name), []);

  const layerById = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
  const allActive = activeLayers.length === LAYERS.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f4ff] font-sans">

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="flex w-64 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r-2 border-indigo-900 bg-white p-3">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-1 mt-1 px-1">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-indigo-900 bg-indigo-600 shadow-[3px_3px_0_#1e1b4b]">
              <span className="text-xl">🏙️</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-indigo-900">
              RovUrbEq
            </h1>
          </div>

          <div className="mb-1 h-0.5 w-full rounded-full bg-indigo-100"></div>

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

          
        </aside>

        {/* ── Map area ────────────────────────────────────────────────────── */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {/* Map */}
          <div className="relative m-4 flex-1 overflow-hidden rounded-2xl border-2 border-indigo-900 shadow-[6px_6px_0_#1e1b4b]">
            {/* Overlay Controls */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between p-4">
              
              <div className="flex-1" /> {/* Spacer sinistro */}

              {/* Stats pills in posizione centrale */}
              <div className="pointer-events-auto flex flex-shrink-0 items-start justify-center gap-3 flex-1">
                <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 bg-white/90 px-4 py-2 shadow-[3px_3px_0_#1e1b4b] backdrop-blur-sm">
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
                <div className="flex items-center gap-2 rounded-xl border-2 border-indigo-900 bg-white/90 px-4 py-2 shadow-[3px_3px_0_#1e1b4b] backdrop-blur-sm">
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
              </div>

              {/* Chat toggle in alto a destra */}
              <div className="pointer-events-auto flex flex-1 items-start justify-end">
                <button
                  onClick={() => setChatOpen((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-indigo-900 shadow-[3px_3px_0_#1e1b4b] transition-colors"
                  style={{
                    background: chatOpen ? "#f0f0ff" : "#6366f1",
                    color: chatOpen ? "#3730a3" : "#fff",
                  }}
                  title={chatOpen ? "Chiudi Chat" : "AI Chat"}
                >
                  <span className="text-lg">{chatOpen ? "➡️" : "✨"}</span>
                </button>
              </div>
            </div>

            <LeafletMap
              activeLayers={activeLayers}
              showZones={showZones}
              onCountChange={handleCount}
              onLoadingChange={handleLoading}
              onZoneClick={handleZoneClick}
            />

            {/* Zone equity detail overlay */}
            {selectedZone && (
              <ZoneDetailPanel
                zoneName={selectedZone}
                onClose={() => setSelectedZone(null)}
              />
            )}
          </div>
        </main>

        {/* ── Chat panel ──────────────────────────────────────────────────── */}
        <aside
          className={`chat-panel flex-shrink-0 border-l-2 border-indigo-900 ${
            chatOpen ? "chat-panel-open w-96" : "chat-panel-closed"
          }`}
        >
          {chatOpen && <AiChat selectedZone={selectedZone} />}
        </aside>
      </div>
    </div>
  );
}
