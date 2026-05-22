// ── Default Equity Configuration ─────────────────────────────────────────────
// Maps Rovereto's actual MongoDB subcategories to the gravity-model parameters
// and defines the demographic weighting matrix for the 4 age groups.

import type { EquityConfig } from "./equity";

/**
 * Service rules keyed by the **exact** `subcategory` value stored in MongoDB.
 *
 * - `weight`         → base importance (1-5) used in the decay formula
 * - `maxRadius`      → linear-decay cutoff in **metres**
 * - `equityCategory` → high-level functional bucket for the demographic matrix
 *
 * Note: some DB categories (e.g. "Comunità > Alimentari") are re-mapped to
 * different equity categories (e.g. "Servizi") to match the PA planning model.
 */
export const DEFAULT_EQUITY_CONFIG: EquityConfig = {
  serviceRules: {
    // ── Educazione ──────────────────────────────────────────────────────────
    "asili":              { weight: 5, maxRadius: 1000, equityCategory: "Educazione" },
    "scuole":             { weight: 4, maxRadius: 1500, equityCategory: "Educazione" },

    // ── Salute ──────────────────────────────────────────────────────────────
    "farmacia":           { weight: 5, maxRadius: 800,  equityCategory: "Salute" },
    "rsa":                { weight: 4, maxRadius: 2000, equityCategory: "Salute" },
    "servizi di cura":    { weight: 3, maxRadius: 1500, equityCategory: "Salute" },

    // ── Servizi ─────────────────────────────────────────────────────────────
    "Poste":              { weight: 3, maxRadius: 1500, equityCategory: "Servizi" },
    "Alimentari":         { weight: 5, maxRadius: 800,  equityCategory: "Servizi" },

    // ── Comunità ────────────────────────────────────────────────────────────
    "Biblioteca":         { weight: 3, maxRadius: 2000, equityCategory: "Comunità" },
    "Campi sportivi":     { weight: 3, maxRadius: 2000, equityCategory: "Comunità" },
    "Parchi":             { weight: 4, maxRadius: 1000, equityCategory: "Comunità" },

    // ── Mobilità ────────────────────────────────────────────────────────────
    "fermate_bus":        { weight: 5, maxRadius: 500,  equityCategory: "Mobilità" },
    "parcheggiAutoMoto":  { weight: 3, maxRadius: 800,  equityCategory: "Mobilità" },
    "ParcheggioBici":     { weight: 2, maxRadius: 600,  equityCategory: "Mobilità" },
  },

  /**
   * Demographic weighting matrix.
   *
   * Each age group assigns a fraction (summing to 1.0) of importance to the
   * high-level equity categories. These fractions are multiplied against the
   * normalised category score (0-100) to produce the age-specific index.
   *
   *   Bambini  → heavy on education & parks
   *   Giovani  → heavy on mobility & community
   *   Adulti   → balanced across services, mobility, education, health
   *   Anziani  → heavy on health & essential services
   */
  ageDemographics: {
    "Bambini (0-14)": {
      "Educazione": 0.50,
      "Comunità":   0.30,
      "Salute":     0.20,
    },
    "Giovani (15-25)": {
      "Mobilità":   0.40,
      "Educazione": 0.20,
      "Comunità":   0.20,
      "Servizi":    0.20,
    },
    "Adulti (26-64)": {
      "Servizi":    0.30,
      "Mobilità":   0.30,
      "Educazione": 0.20,
      "Salute":     0.20,
    },
    "Anziani (65+)": {
      "Salute":     0.50,
      "Servizi":    0.30,
      "Comunità":   0.20,
    },
  },
};
