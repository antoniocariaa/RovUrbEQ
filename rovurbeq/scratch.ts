import mongoose from "mongoose";
import * as turf from "@turf/turf";

const MONGODB_URI = "mongodb+srv://antoniocaria1_db_user:uKYj4nbMZj2JO2ai@cluster0.pxbazdu.mongodb.net/test";

async function test() {
  await mongoose.connect(MONGODB_URI);
  
  const LocationSchema = new mongoose.Schema({
    geometry: mongoose.Schema.Types.Mixed
  });
  const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema, 'locations');

  const docs = await Location.find({}, "geometry").lean();
  console.log("Docs fetched:", docs.length);

  type Geometry = {
    type: string;
    coordinates: any;
  };

  function polygonCentroid(coords: number[][][]): [number, number] {
    const ring = coords[0];
    let sumLat = 0, sumLng = 0;
    for (const [lo, la] of ring) { sumLng += lo; sumLat += la; }
    return [sumLat / ring.length, sumLng / ring.length];
  }

  function extractLatLng(geometry: Geometry): [number, number] | null {
    if (!geometry) return null;
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

  const points = docs.flatMap((doc) => {
    const geo = doc.geometry as Geometry;
    if (!geo) return [];

    const latLng = extractLatLng(geo);
    if (!latLng) return [];

    const [lat, lng] = latLng;
    return [turf.point([lng, lat])];
  });
  
  console.log("Points extracted:", points.length);
  
  const featureCollection = turf.featureCollection(points);
  try {
    const hull = turf.convex(featureCollection);
    console.log("Convex hull computed.");
    const bufferedHull = turf.buffer(hull, 0.5, { units: "kilometers" });
    console.log("Buffered hull computed.");
  } catch (err) {
    console.error("Turf Error:", err);
  }

  mongoose.disconnect();
}
test();
