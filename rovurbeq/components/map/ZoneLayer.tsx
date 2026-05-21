"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import type { Feature, Polygon, GeoJsonProperties } from "geojson";

interface ZoneLayerProps {
  showZones: boolean;
  onZoneClick?: (zoneName: string) => void;
}

export default function ZoneLayer({ showZones, onZoneClick }: ZoneLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  // Keep a ref to the latest callback so we don't re-create the layer when
  // only the callback identity changes.
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;

  useEffect(() => {
    let active = true;

    async function loadZones() {
      if (!showZones) {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
        return;
      }

      if (layerRef.current) return;

      try {
        const [zonesRes, boundaryRes] = await Promise.all([
          fetch("/api/zones"),
          fetch("/api/boundary"),
        ]);

        if (!zonesRes.ok) throw new Error("Failed to load zones");
        if (!boundaryRes.ok) throw new Error("Failed to load boundary");

        const data = await zonesRes.json();
        const boundary = await boundaryRes.json();

        if (!active || !data.features || data.features.length === 0) return;

        // Calculate bounding box and add padding to cover the whole city
        const bbox = turf.bbox(data);
        const paddedBbox: [number, number, number, number] = [
          bbox[0] - 0.1,
          bbox[1] - 0.1,
          bbox[2] + 0.1,
          bbox[3] + 0.1,
        ];

        // Generate Voronoi polygons
        const voronoiPolygons = turf.voronoi(data, { bbox: paddedBbox });

        // Clip Voronoi polygons to the city boundary and merge properties
        const clippedFeatures: Feature<Polygon, GeoJsonProperties>[] = [];

        voronoiPolygons.features.forEach((polygon, index) => {
          if (!polygon) return;
          
          try {
            // Intersect the voronoi cell with our city boundary
            const clipped = turf.intersect(turf.featureCollection([polygon, boundary]));
            if (clipped && clipped.geometry.type === 'Polygon') {
              clipped.properties = data.features[index].properties;
              clippedFeatures.push(clipped as Feature<Polygon, GeoJsonProperties>);
            } else if (clipped && clipped.geometry.type === 'MultiPolygon') {
               // Just take the first polygon if it results in multipolygon
               clipped.properties = data.features[index].properties;
               clippedFeatures.push(turf.polygon(clipped.geometry.coordinates[0], clipped.properties));
            }
          } catch (e) {
            console.error("Error clipping polygon", e);
          }
        });

        const validPolygons = turf.featureCollection(clippedFeatures);

        const geoJsonLayer = L.geoJSON(validPolygons, {
          style: {
            color: "#4338ca",    // indigo-700
            weight: 2,
            opacity: 0.6,
            fillColor: "#6366f1", // indigo-500
            fillOpacity: 0.1,
            dashArray: "5, 5",
          },
          onEachFeature: (feature, layer) => {
            const name = feature.properties?.name || "Zona";
            
            // Tooltip in the center of the polygon
            layer.bindTooltip(
              `<div style="font-family:'Inter',system-ui,sans-serif;font-weight:800;font-size:12px;color:#312e81;text-transform:uppercase;letter-spacing:0.05em;text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${name}</div>`,
              {
                permanent: true,
                direction: "center",
                className: "zone-tooltip",
              }
            );

            // Hover effects
            layer.on({
              mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                  fillOpacity: 0.25,
                  weight: 3,
                  color: "#312e81",
                });
                l.bringToFront();
              },
              mouseout: (e) => {
                geoJsonLayer.resetStyle(e.target);
              },
              click: () => {
                onZoneClickRef.current?.(name);
              },
            });
          },
        });

        if (active) {
          layerRef.current = geoJsonLayer;
          geoJsonLayer.addTo(map);
        }
      } catch (err) {
        console.error("Error drawing zones:", err);
      }
    }

    loadZones();

    return () => {
      active = false;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [showZones, map]);

  return null;
}
