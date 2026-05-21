// ── GET /api/locations?layerId=asili ─────────────────────────────────────────
// Returns all map points for a given layerId as a JSON array of GeoPoints.
// Runs server-side only — Mongoose / MONGODB_URI never exposed to the browser.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Location } from "@/models/Location";
import { LAYERS } from "@/lib/layers";

export async function GET(req: NextRequest) {
  const layerId = req.nextUrl.searchParams.get("layerId");

  if (!layerId) {
    return NextResponse.json({ error: "Missing layerId parameter" }, { status: 400 });
  }

  const layerConfig = LAYERS.find((l) => l.id === layerId);
  if (!layerConfig) {
    return NextResponse.json({ error: `Unknown layerId: ${layerId}` }, { status: 400 });
  }

  try {
    await connectDB();

    // Query by category + subcategory stored on the layer config
    const docs = await Location.find({
      category: layerConfig.category,
      subcategory: layerConfig.subcategory,
    }).lean();

    // ── Convert MongoDB documents → GeoPoint shape ─────────────────────────
    const points = docs.flatMap((doc, i) => {
      const geo = doc.geometry;
      if (!geo) return [];

      const latLng = extractLatLng(geo);
      if (!latLng) return [];

      const [lat, lng] = latLng;
      const p = (doc.properties as Record<string, unknown>) ?? {};

      return [{
        id: `${layerId}-${(doc._id as { toString(): string }).toString() ?? i}`,
        name:
          (p["name"] as string) ??
          (p["amenity"] as string) ??
          (p["shop"] as string) ??
          (p["leisure"] as string) ??
          (p["highway"] as string) ??
          layerConfig.label,
        lat,
        lng,
        layerId,
        address:
          [p["addr:street"], p["addr:housenumber"]]
            .filter(Boolean)
            .join(" ") || undefined,
        phone: (p["phone"] as string) ?? (p["contact_phone"] as string) ?? undefined,
        website: (p["website"] as string) ?? undefined,
      }];
    });

    return NextResponse.json(points);
  } catch (err) {
    console.error("[api/locations] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Geometry helpers (server-side copy — no Leaflet dependency) ───────────────
type Geometry = {
  type: string;
  coordinates: unknown;
};

function polygonCentroid(coords: number[][][]): [number, number] {
  const ring = coords[0];
  let sumLat = 0, sumLng = 0;
  for (const [lo, la] of ring) { sumLng += lo; sumLat += la; }
  return [sumLat / ring.length, sumLng / ring.length];
}

function extractLatLng(geometry: Geometry): [number, number] | null {
  switch (geometry.type) {
    case "Point": {
      const [lng, lat] = geometry.coordinates as [number, number];
      return [lat, lng];
    }
    case "Polygon":
      return polygonCentroid(geometry.coordinates as number[][][]);
    case "MultiPolygon":
      return polygonCentroid((geometry.coordinates as number[][][][])[0]);
    case "LineString": {
      const c = geometry.coordinates as number[][];
      const m = Math.floor(c.length / 2);
      return [c[m][1], c[m][0]];
    }
    case "MultiLineString": {
      const c = (geometry.coordinates as number[][][])[0];
      const m = Math.floor(c.length / 2);
      return [c[m][1], c[m][0]];
    }
    default: return null;
  }
}
