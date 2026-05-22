// ── GET /api/equity ──────────────────────────────────────────────────────────
// Computes the Urban Equity Score for every zone (quartiere) in Rovereto.
//
// Flow:
//   1. Fetch all zone centroids from the `zones` collection
//   2. Fetch all service locations from the `locations` collection
//   3. Convert both to GeoJSON FeatureCollections
//   4. Run the gravity-model equity computation
//   5. Return the scored results as JSON
//
// Optional query params:
//   ?zone=Lizzana    → filter results to a single zone (case-insensitive)

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Zone } from "@/models/Zone";
import { Location } from "@/models/Location";
import { computeEquityScores } from "@/lib/equity";
import { DEFAULT_EQUITY_CONFIG } from "@/lib/equityConfig";
import type { FeatureCollection, Point, Feature } from "geojson";

export async function GET(req: NextRequest) {
  const zoneFilter = req.nextUrl.searchParams.get("zone"); // optional

  try {
    await connectDB();

    // ── 1. Fetch zone centroids ─────────────────────────────────────────────
    const zoneDocs = await Zone.find({}).lean();

    if (zoneDocs.length === 0) {
      return Response.json(
        { error: "Nessuna zona trovata nel database" },
        { status: 404 }
      );
    }

    const zonesFC: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: zoneDocs.map((z) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: z.geometry.coordinates as [number, number],
        },
        properties: {
          name: z.name,
          id: String(z._id),
          osmId: z.osmId,
        },
      })),
    };

    // ── 2. Fetch all service locations ──────────────────────────────────────
    const locationDocs = await Location.find({}).lean();

    const servicesFC: FeatureCollection = {
      type: "FeatureCollection",
      features: locationDocs
        .filter((loc) => loc.geometry?.type && loc.geometry?.coordinates)
        .map((loc) => ({
          type: "Feature" as const,
          geometry: loc.geometry as Feature["geometry"],
          properties: {
            name: loc.name,
            category: loc.category,
            subcategory: loc.subcategory,
          },
        })),
    };

    // ── 3. Compute equity scores ────────────────────────────────────────────
    let results = computeEquityScores(
      zonesFC,
      servicesFC,
      DEFAULT_EQUITY_CONFIG
    );

    // ── 4. Optional: filter to a single zone ────────────────────────────────
    if (zoneFilter) {
      const needle = zoneFilter.toLowerCase();
      results = results.filter(
        (r) => r.name.toLowerCase() === needle
      );
      if (results.length === 0) {
        return Response.json(
          { error: `Zona "${zoneFilter}" non trovata` },
          { status: 404 }
        );
      }
    }

    // ── 5. Return ───────────────────────────────────────────────────────────
    return Response.json({
      meta: {
        totalZones: zoneDocs.length,
        totalServices: servicesFC.features.length,
        model: "linear-decay gravity",
        categories: Object.keys(
          results[0]?.categoryScores ?? {}
        ),
        ageGroups: Object.keys(
          results[0]?.ageGroupScores ?? {}
        ),
      },
      results,
    });
  } catch (err) {
    console.error("[api/equity] Error:", err);
    return Response.json(
      { error: "Errore interno nel calcolo dell'equity score" },
      { status: 500 }
    );
  }
}
