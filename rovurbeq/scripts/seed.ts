import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Location } from '../models/Location';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

const DATI_DIR = path.join(__dirname, '../dati');

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected successfully.');

    console.log('Clearing existing locations data...');
    await Location.deleteMany({});
    console.log('Old data cleared.');

    const categories = fs.readdirSync(DATI_DIR).filter(file => {
      // Exclude hidden files or non-directory items
      if (file.startsWith('.')) return false;
      return fs.statSync(path.join(DATI_DIR, file)).isDirectory();
    });

    for (const category of categories) {
      const categoryPath = path.join(DATI_DIR, category);
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.geojson'));

      for (const file of files) {
        const subcategory = path.basename(file, '.geojson');
        const filePath = path.join(categoryPath, file);
        
        console.log(`Processing ${category} -> ${subcategory}...`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const geojsonData = JSON.parse(fileContent);

        if (geojsonData.type === 'FeatureCollection' && Array.isArray(geojsonData.features)) {
          const docs = geojsonData.features.map((feature: any) => {
            return {
              category,
              subcategory,
              // Attempt to extract name from properties
              name: feature.properties?.name || feature.properties?.Name || feature.properties?.['name:it'],
              type: feature.type, // Usually 'Feature'
              geometry: feature.geometry,
              properties: feature.properties || {},
            };
          });

          if (docs.length > 0) {
            await Location.insertMany(docs);
            console.log(` + Inserted ${docs.length} records for ${subcategory}`);
          } else {
            console.log(` - No features found to insert in ${file}`);
          }
        } else {
          console.warn(` ! Skipped ${file}: not a valid FeatureCollection`);
        }
      }
    }

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seedDatabase();
