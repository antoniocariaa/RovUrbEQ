// ── Urban Equity Score — Gravity Model Engine ────────────────────────────────
// Pure computation module. No database or framework imports — only @turf/turf
// for geospatial distance calculations. This keeps the function unit-testable
// and portable.
//
// Mathematical Model (linear-decay gravity):
//
//   Score_i = Weight × max(0, 1 − Distance / MaxRadius)
//
// where Distance is the great-circle distance (metres) between a zone centroid
// and a service point, Weight is the service's base importance (1-5), and
// MaxRadius is the service's maximum influence radius.

import * as turf from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Point,
  Geometry,
} from "geojson";

// ── Public types ─────────────────────────────────────────────────────────────

/** Rule for a single service type (keyed by subcategory in the DB). */
export interface ServiceRule {
  /** Base importance weight (1 = low … 5 = essential) */
  weight: number;
  /** Maximum influence radius in metres — beyond this, contribution = 0 */
  maxRadius: number;
  /** High-level functional category: "Educazione", "Salute", … */
  equityCategory: string;
}

/** Full configuration object for the equity computation. */
export interface EquityConfig {
  /**
   * Maps a service **subcategory** (as stored in MongoDB) to its gravity-model
   * parameters and its high-level equity category.
   */
  serviceRules: Record<string, ServiceRule>;
  /**
   * Demographic weighting matrix.
   * Outer key  = age-group label (e.g. "Bambini (0-14)")
   * Inner key  = equity category  (e.g. "Salute")
   * Inner value = percentage weight (0-1, should sum to 1.0 per age group)
   */
  ageDemographics: Record<string, Record<string, number>>;
}

/** Equity result for a single zone / quartiere. */
export interface ZoneEquityResult {
  /** Zone/quartiere name */
  name: string;
  /** Overall accessibility index 0-100 (mean of age-group scores) */
  generalScore: number;
  /** Normalised score (0-100) per functional category */
  categoryScores: Record<string, number>;
  /** Weighted accessibility score (0-100) per demographic age group */
  ageGroupScores: Record<string, number>;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extracts a centroid [lng, lat] from any GeoJSON geometry.
 * For Point geometries this is a no-op; for Polygons / Lines / Multi*
 * it delegates to turf.centroid.
 */
function getCentroid(geometry: Geometry): [number, number] {
  if (geometry.type === "Point") {
    return geometry.coordinates as [number, number];
  }
  const centroid = turf.centroid({
    type: "Feature",
    geometry,
    properties: {},
  } as Feature);
  return centroid.geometry.coordinates as [number, number];
}

/** Pre-processed service used during the scoring loop. */
interface ProcessedService {
  coords: [number, number];
  rule: ServiceRule;
}

// ── Core computation ─────────────────────────────────────────────────────────

/**
 * Computes the Urban Equity Score for every zone centroid.
 *
 * **Algorithm (3 phases):**
 *
 * 1. **Raw scoring** — For each zone-centroid × service pair, apply the
 *    linear-decay gravity formula and accumulate the raw category score.
 *
 * 2. **Normalisation** — Within each functional category, divide by the
 *    maximum raw score observed across all zones, then scale to 0-100.
 *    This produces a *relative* ranking: the best-served zone in that
 *    category receives 100.
 *
 * 3. **Demographic weighting** — For each of the 4 age groups, compute a
 *    weighted sum of the normalised category scores using the percentages
 *    in `ageDemographics`. The general score is the arithmetic mean of
 *    the 4 age-group indices.
 *
 * @param zones    FeatureCollection of zone centroid Points (need `name` in properties)
 * @param services FeatureCollection of service features (need `subcategory` in properties)
 * @param config   Service rules + demographic matrix
 * @returns        Array of ZoneEquityResult sorted by generalScore (desc)
 */
export function computeEquityScores(
  zones: FeatureCollection<Point>,
  services: FeatureCollection,
  config: EquityConfig
): ZoneEquityResult[] {
  const { serviceRules, ageDemographics } = config;

  // ── Collect all unique equity categories ──────────────────────────────────
  const categorySet = new Set<string>();
  for (const rule of Object.values(serviceRules)) {
    categorySet.add(rule.equityCategory);
  }
  const categories = [...categorySet].sort();

  // ── Pre-process services: centroid + matched rule ─────────────────────────
  const processedServices: ProcessedService[] = [];
  for (const feature of services.features) {
    const subcategory = feature.properties?.subcategory as string | undefined;
    if (!subcategory || !serviceRules[subcategory]) continue;

    try {
      const coords = getCentroid(feature.geometry);
      processedServices.push({ coords, rule: serviceRules[subcategory] });
    } catch {
      // skip features with un-parsable geometry
    }
  }

  // ── Phase 1: Raw category scores per zone ─────────────────────────────────
  interface RawZoneData {
    name: string;
    rawScores: Record<string, number>;
  }

  const rawData: RawZoneData[] = [];

  for (const zone of zones.features) {
    const zoneName = (zone.properties?.name as string) ?? "Sconosciuto";
    const zoneCoords = zone.geometry.coordinates as [number, number];
    const zonePoint = turf.point(zoneCoords);

    // Initialise accumulators
    const rawScores: Record<string, number> = {};
    for (const cat of categories) rawScores[cat] = 0;

    // Gravity-model accumulation
    for (const svc of processedServices) {
      const distanceM = turf.distance(zonePoint, turf.point(svc.coords), {
        units: "meters",
      });

      const { weight, maxRadius, equityCategory } = svc.rule;

      if (distanceM < maxRadius) {
        // Linear decay: full weight at distance 0, zero at maxRadius
        const score = weight * (1 - distanceM / maxRadius);
        rawScores[equityCategory] += score;
      }
    }

    rawData.push({ name: zoneName, rawScores });
  }

  // ── Phase 2: Normalise category scores to 0-100 ──────────────────────────
  // Find the maximum raw score per category across all zones
  const maxPerCategory: Record<string, number> = {};
  for (const cat of categories) {
    let max = 0;
    for (const zone of rawData) {
      if (zone.rawScores[cat] > max) max = zone.rawScores[cat];
    }
    maxPerCategory[cat] = max;
  }

  // ── Phase 3: Assemble final results ───────────────────────────────────────
  const results: ZoneEquityResult[] = rawData.map((zone) => {
    // Normalised category scores
    const categoryScores: Record<string, number> = {};
    for (const cat of categories) {
      const max = maxPerCategory[cat];
      categoryScores[cat] =
        max > 0
          ? Math.round((zone.rawScores[cat] / max) * 100 * 10) / 10
          : 0;
    }

    // Age-group weighted scores
    const ageGroupScores: Record<string, number> = {};
    for (const [ageGroup, weights] of Object.entries(ageDemographics)) {
      let score = 0;
      for (const [cat, pct] of Object.entries(weights)) {
        score += (categoryScores[cat] ?? 0) * pct;
      }
      ageGroupScores[ageGroup] = Math.round(score * 10) / 10;
    }

    // General score = arithmetic mean of the 4 age-group indices
    const ageValues = Object.values(ageGroupScores);
    const generalScore =
      ageValues.length > 0
        ? Math.round(
            (ageValues.reduce((a, b) => a + b, 0) / ageValues.length) * 10
          ) / 10
        : 0;

    return { name: zone.name, generalScore, categoryScores, ageGroupScores };
  });

  // Sort best → worst
  results.sort((a, b) => b.generalScore - a.generalScore);

  return results;
}
