import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Zone } from "@/models/Zone";

export async function GET() {
  try {
    await connectDB();
    const zones = await Zone.find({}).lean();
    
    const features = zones.map((z) => ({
      type: "Feature",
      geometry: z.geometry,
      properties: {
        id: (z._id as { toString(): string }).toString(),
        name: z.name,
        osmId: z.osmId,
        place: z.place,
      },
    }));

    return NextResponse.json({
      type: "FeatureCollection",
      features,
    });
  } catch (err) {
    console.error("[api/zones] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
