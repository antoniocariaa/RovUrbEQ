import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Location } from "@/models/Location";
import * as turf from "@turf/turf";

export async function GET() {
  try {
    await connectDB();
    const docs = await Location.find({}, "geometry").lean();

    const points = docs.flatMap((doc) => {
      const geo = doc.geometry;
      if (!geo) return [];

      const latLng = extractLatLng(geo);
      if (!latLng) return [];

      const [lat, lng] = latLng;
      
      // Filter out wild outliers (e.g., Naples, Munich) from OSM data
      // Rovereto is around 11.04, 45.89. We keep only points in this tight box.
      if (lng < 10.9 || lng > 11.2 || lat < 45.8 || lat > 46.0) {
        return [];
      }

      return [turf.point([lng, lat])];
    });

    if (points.length === 0) {
      return NextResponse.json({ error: "No locations found" }, { status: 404 });
    }

    // Custom Convex Hull (Monotone Chain) to avoid Turbopack/ESM 'rbush' compilation errors
    function getConvexHull(pts: [number, number][]): [number, number][] {
      pts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
      const cross = (o: [number, number], a: [number, number], b: [number, number]) => {
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      };
      const lower = [];
      for (let i = 0; i < pts.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) {
          lower.pop();
        }
        lower.push(pts[i]);
      }
      const upper = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) {
          upper.pop();
        }
        upper.push(pts[i]);
      }
      upper.pop();
      lower.pop();
      const hull = lower.concat(upper);
      if (hull.length > 0) {
        hull.push([...hull[0]]);
      }
      return hull;
    }

    const coords = points.map((p) => p.geometry.coordinates as [number, number]);
    const hullCoords = getConvexHull(coords);

    if (hullCoords.length < 4) {
      return NextResponse.json({ error: "Could not compute convex hull" }, { status: 500 });
    }

    const hull = turf.polygon([hullCoords]);

    // Buffer the convex hull slightly (e.g., 500 meters) so it doesn't strictly cut off border points
    const bufferedHull = turf.buffer(hull, 0.5, { units: "kilometers" });

    return NextResponse.json(bufferedHull);
  } catch (err: any) {
    console.error("[api/boundary] Error:", err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
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
