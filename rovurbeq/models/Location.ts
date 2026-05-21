import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILocation extends Document {
  category: string;
  subcategory: string;
  name?: string;
  type?: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: Record<string, any>;
}

const LocationSchema: Schema = new Schema({
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  name: { type: String },
  type: { type: String },
  geometry: {
    type: {
      type: String,
      enum: ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  properties: { type: Schema.Types.Mixed }
});

// Create a 2dsphere index on the geometry field for geospatial queries
LocationSchema.index({ geometry: '2dsphere' });

export const Location: Model<ILocation> = mongoose.models?.Location || mongoose.model<ILocation>('Location', LocationSchema, 'locations');
