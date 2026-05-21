import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Location } from '../models/Location';
import { Zone } from '../models/Zone';

// Carica le variabili d'ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI non è definto in .env');
  process.exit(1);
}

// Formula di Haversine per calcolare la distanza in km tra due coordinate
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

// Estrae il primo punto di una geometria
function getCoordinates(geometry: any): [number, number] | null {
  if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0][0][0], geometry.coordinates[0][0][1]];
  if (geometry.type === 'MultiPolygon') return [geometry.coordinates[0][0][0][0], geometry.coordinates[0][0][0][1]];
  if (geometry.type === 'LineString') return [geometry.coordinates[0][0], geometry.coordinates[0][1]];
  return null;
}

async function updateLocationsQuartiere() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connesso a MongoDB');

    // Carica il file JSON delle zone
    const zoneDataPath = path.join(__dirname, '../dati/Zone.geojson');
    const zoneGeoJSON = JSON.parse(fs.readFileSync(zoneDataPath, 'utf8'));
    const zones = zoneGeoJSON.features;

    console.log('🔄 Sincronizzazione zone nel database...');
    const zoneDbMap = new Map<string, any>();
    
    // Inserisci o aggiorna le zone nel database
    for (const z of zones) {
      if (!z.properties || !z.geometry) continue;
      
      const osmId = z.id || z.properties['@id'];
      if (!osmId) continue;
      
      const zoneDoc = await Zone.findOneAndUpdate(
        { osmId: osmId },
        {
          osmId: osmId,
          name: z.properties.name || z.properties.loc_name || 'Sconosciuto',
          place: z.properties.place,
          geometry: z.geometry,
          properties: z.properties
        },
        { upsert: true, returnDocument: 'after' }
      );
      
      zoneDbMap.set(osmId, zoneDoc);
    }
    
    console.log(`✅ ${zoneDbMap.size} zone sincronizzate.`);

    const locations = await Location.find({});
    let updatedCount = 0;

    for (const loc of locations) {
      const coords = getCoordinates(loc.geometry);
      if (!coords) continue;
      
      const [lon, lat] = coords;
      let minDistance = Infinity;
      let nearestZoneId: mongoose.Types.ObjectId | null = null;

      // Trova la zona più vicina
      for (const zone of zones) {
        if (zone.geometry.type === 'Point') {
          const zoneLon = zone.geometry.coordinates[0];
          const zoneLat = zone.geometry.coordinates[1];
          
          const dist = getDistance(lat, lon, zoneLat, zoneLon);
          if (dist < minDistance) {
            minDistance = dist;
            const osmId = zone.id || zone.properties['@id'];
            nearestZoneId = zoneDbMap.get(osmId)?._id || null;
          }
        }
      }

      if (nearestZoneId) {
        loc.quartiere = nearestZoneId;
        await loc.save();
        updatedCount++;
      }
    }

    console.log(`✅ Aggiornate ${updatedCount} locations con il quartiere più vicino.`);
  } catch (error) {
    console.error("❌ Errore durante l'aggiornamento:", error);
  } finally {
    await mongoose.disconnect();
    console.log('💤 Disconnesso da MongoDB');
  }
}

updateLocationsQuartiere();