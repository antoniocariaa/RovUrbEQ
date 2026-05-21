"use client";

import { useState, useEffect } from "react";
import RadarChart from "./RadarChart";

// ── Types matching the /api/equity response ──────────────────────────────────
interface ZoneEquityResult {
  name: string;
  generalScore: number;
  categoryScores: Record<string, number>;
  ageGroupScores: Record<string, number>;
}

interface EquityResponse {
  meta: {
    totalZones: number;
    totalServices: number;
    model: string;
    categories: string[];
    ageGroups: string[];
  };
  results: ZoneEquityResult[];
}

interface ZoneDetailPanelProps {
  zoneName: string;
  onClose: () => void;
}

// ── Age group config ─────────────────────────────────────────────────────────
const AGE_META: Record<string, { emoji: string; color: string; border: string }> = {
  "Bambini (0-14)":  { emoji: "👶", color: "#6366f1", border: "#1e1b4b" },
  "Giovani (15-25)": { emoji: "🧑", color: "#8b5cf6", border: "#1e1b4b" },
  "Adulti (26-64)":  { emoji: "👨", color: "#0ea5e9", border: "#0c4a6e" },
  "Anziani (65+)":   { emoji: "👴", color: "#f59e0b", border: "#78350f" },
};

// ── Score badge color ────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

function scoreBg(score: number): string {
  if (score >= 75) return "#ecfdf5";
  if (score >= 50) return "#fffbeb";
  if (score >= 25) return "#fff7ed";
  return "#fef2f2";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Ottimo";
  if (score >= 50) return "Buono";
  if (score >= 25) return "Sufficiente";
  return "Critico";
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ZoneDetailPanel({ zoneName, onClose }: ZoneDetailPanelProps) {
  const [data, setData] = useState<ZoneEquityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/equity?zone=${encodeURIComponent(zoneName)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<EquityResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        if (json.results.length > 0) {
          setData(json.results[0]);
        } else {
          setError("Nessun dato disponibile per questa zona.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[ZoneDetailPanel]", err);
        setError("Errore nel caricamento dei dati.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [zoneName]);

  return (
    <div className="zone-detail-panel absolute bottom-4 left-4 z-[1000] w-[370px] max-h-[calc(100%-2rem)] flex flex-col rounded-2xl border-2 border-indigo-900 bg-white shadow-[6px_6px_0_#1e1b4b] overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b-2 border-indigo-900 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📊</span>
          <div className="leading-none">
            <p className="text-sm font-extrabold text-white">{zoneName}</p>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-indigo-200">
              Urban Equity Score
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto chat-scroll p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 border-t-indigo-600" />
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              Calcolo in corso…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-700">⚠️ {error}</p>
          </div>
        )}

        {data && (
          <>
            {/* ── General Score ───────────────────────────────────────────── */}
            <div
              className="mb-4 flex items-center gap-3 rounded-xl border-2 p-3"
              style={{
                borderColor: scoreColor(data.generalScore),
                background: scoreBg(data.generalScore),
              }}
            >
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 font-extrabold text-white text-lg"
                style={{
                  borderColor: scoreColor(data.generalScore),
                  background: scoreColor(data.generalScore),
                  boxShadow: `3px 3px 0 ${scoreColor(data.generalScore)}66`,
                }}
              >
                {data.generalScore}
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: scoreColor(data.generalScore) }}>
                  {scoreLabel(data.generalScore)}
                </p>
                <p className="text-[10px] font-semibold text-gray-500">
                  Indice generale di accessibilità
                </p>
              </div>
            </div>

            {/* ── Radar Chart ────────────────────────────────────────────── */}
            <div className="mb-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-2">
              <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                Accessibilità per categoria
              </p>
              <div className="flex justify-center">
                <RadarChart data={data.categoryScores} size={230} />
              </div>
            </div>

            {/* ── Category Breakdown ─────────────────────────────────────── */}
            <div className="mb-4">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                Dettaglio categorie
              </p>
              <div className="flex flex-col gap-2">
                {Object.entries(data.categoryScores).map(([cat, score]) => {
                  const EMOJIS: Record<string, string> = {
                    Educazione: "📚", Salute: "🩺", Servizi: "📮",
                    Comunità: "🌳", Mobilità: "🚌",
                  };
                  const COLORS: Record<string, string> = {
                    Educazione: "#6366f1", Salute: "#10b981", Servizi: "#f97316",
                    Comunità: "#22c55e", Mobilità: "#e879f9",
                  };
                  const c = COLORS[cat] ?? "#6366f1";
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-xs w-5 text-center">{EMOJIS[cat] ?? "📌"}</span>
                      <span className="text-[10px] font-bold text-gray-600 w-20 truncate">{cat}</span>
                      <div className="flex-1 h-3 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${score}%`,
                            background: `linear-gradient(90deg, ${c}88, ${c})`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-extrabold w-8 text-right" style={{ color: c }}>
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Age Group Scores ───────────────────────────────────────── */}
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                Accessibilità per fascia d&apos;età
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.ageGroupScores).map(([group, score]) => {
                  const meta = AGE_META[group] ?? { emoji: "👤", color: "#6366f1", border: "#1e1b4b" };
                  return (
                    <div
                      key={group}
                      className="flex items-center gap-2.5 rounded-xl border-2 p-2.5"
                      style={{
                        borderColor: meta.border,
                        background: `${meta.color}10`,
                        boxShadow: `2px 2px 0 ${meta.border}`,
                      }}
                    >
                      <span className="text-lg">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-600 truncate">{group}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${score}%`,
                                background: meta.color,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-extrabold" style={{ color: meta.color }}>
                            {score}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
