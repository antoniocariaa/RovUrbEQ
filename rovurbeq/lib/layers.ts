// ── Layer catalogue — NO Leaflet imports here ─────────────────────────────────
// This file is intentionally free of browser-only dependencies so it can be
// safely imported by Server Components and Client Components alike.

export interface LayerConfig {
  id: string;
  label: string;
  emoji: string;
  path: string; // URL path inside /public, fetched client-side
  color: string; // hex
  borderColor: string;
}

export const LAYERS: LayerConfig[] = [
  { id: "asili",       label: "Asili",           emoji: "🏫", path: "/dati/Ragazzi/asili.geojson",                    color: "#6366f1", borderColor: "#1e1b4b" },
  { id: "scuole",      label: "Scuole",           emoji: "📚", path: "/dati/Ragazzi/scuole.geojson",                   color: "#8b5cf6", borderColor: "#1e1b4b" },
  { id: "farmacie",    label: "Farmacie",         emoji: "💊", path: "/dati/Servizi Sanitari/farmacia.geojson",        color: "#10b981", borderColor: "#064e3b" },
  { id: "rsa",         label: "RSA",              emoji: "🏥", path: "/dati/Servizi Sanitari/rsa.geojson",             color: "#f59e0b", borderColor: "#78350f" },
  { id: "cura",        label: "Servizi di Cura",  emoji: "🩺", path: "/dati/Servizi Sanitari/servizi di cura.geojson", color: "#ef4444", borderColor: "#7f1d1d" },
  { id: "poste",       label: "Poste",            emoji: "📮", path: "/dati/Servizi/Poste.geojson",                    color: "#f97316", borderColor: "#7c2d12" },
  { id: "biblioteche", label: "Biblioteche",      emoji: "📖", path: "/dati/Comunità/Biblioteca.geojson",              color: "#0ea5e9", borderColor: "#0c4a6e" },
  { id: "alimentari",  label: "Alimentari",       emoji: "🛒", path: "/dati/Comunità/Alimentari.geojson",              color: "#84cc16", borderColor: "#365314" },
  { id: "campi",       label: "Campi Sportivi",   emoji: "⚽", path: "/dati/Comunità/Campi sportivi.geojson",          color: "#06b6d4", borderColor: "#164e63" },
  { id: "parchi",      label: "Parchi",           emoji: "🌳", path: "/dati/Comunità/Parchi.geojson",                  color: "#22c55e", borderColor: "#14532d" },
  { id: "bus",         label: "Fermate Bus",      emoji: "🚌", path: "/dati/Mobilità/fermate_bus.geojson",             color: "#e879f9", borderColor: "#701a75" },
  { id: "parking",     label: "Parcheggi Auto",   emoji: "🅿️", path: "/dati/Mobilità/parcheggiAutoMoto.geojson",       color: "#94a3b8", borderColor: "#1e293b" },
  { id: "bici",        label: "Parcheggi Bici",   emoji: "🚲", path: "/dati/Mobilità/ParcheggioBici.geojson",          color: "#fb923c", borderColor: "#7c2d12" },
];
