// ── Layer catalogue — NO Leaflet imports here ─────────────────────────────────
// This file is intentionally free of browser-only dependencies so it can be
// safely imported by Server Components and Client Components alike.

export interface LayerConfig {
  id: string;
  label: string;
  emoji: string;
  /** MongoDB `category` field value */
  category: string;
  /** MongoDB `subcategory` field value */
  subcategory: string;
  color: string;      // hex
  borderColor: string;
}

export const LAYERS: LayerConfig[] = [
  { id: "asili",       label: "Asili",           emoji: "🏫", category: "Ragazzi",           subcategory: "asili",                    color: "#6366f1", borderColor: "#1e1b4b" },
  { id: "scuole",      label: "Scuole",           emoji: "📚", category: "Ragazzi",           subcategory: "scuole",                   color: "#8b5cf6", borderColor: "#1e1b4b" },
  { id: "farmacie",    label: "Farmacie",         emoji: "💊", category: "Servizi Sanitari",  subcategory: "farmacia",                 color: "#10b981", borderColor: "#064e3b" },
  { id: "rsa",         label: "RSA",              emoji: "🏥", category: "Servizi Sanitari",  subcategory: "rsa",                      color: "#f59e0b", borderColor: "#78350f" },
  { id: "cura",        label: "Servizi di Cura",  emoji: "🩺", category: "Servizi Sanitari",  subcategory: "servizi di cura",          color: "#ef4444", borderColor: "#7f1d1d" },
  { id: "poste",       label: "Poste",            emoji: "📮", category: "Servizi",           subcategory: "Poste",                    color: "#f97316", borderColor: "#7c2d12" },
  { id: "biblioteche", label: "Biblioteche",      emoji: "📖", category: "Comunità",          subcategory: "Biblioteca",               color: "#0ea5e9", borderColor: "#0c4a6e" },
  { id: "alimentari",  label: "Alimentari",       emoji: "🛒", category: "Comunità",          subcategory: "Alimentari",               color: "#84cc16", borderColor: "#365314" },
  { id: "campi",       label: "Campi Sportivi",   emoji: "⚽", category: "Comunità",          subcategory: "Campi sportivi",           color: "#06b6d4", borderColor: "#164e63" },
  { id: "parchi",      label: "Parchi",           emoji: "🌳", category: "Comunità",          subcategory: "Parchi",                   color: "#22c55e", borderColor: "#14532d" },
  { id: "bus",         label: "Fermate Bus",      emoji: "🚌", category: "Mobilità",          subcategory: "fermate_bus",              color: "#e879f9", borderColor: "#701a75" },
  { id: "parking",     label: "Parcheggi Auto",   emoji: "🅿️", category: "Mobilità",          subcategory: "parcheggiAutoMoto",        color: "#94a3b8", borderColor: "#1e293b" },
  { id: "bici",        label: "Parcheggi Bici",   emoji: "🚲", category: "Mobilità",          subcategory: "ParcheggioBici",           color: "#fb923c", borderColor: "#7c2d12" },
];
