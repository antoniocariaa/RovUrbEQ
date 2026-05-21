import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IZone extends Document {
  osmId: string;
  name: string;
  place?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: Record<string, unknown>;
}

const ZoneSchema: Schema = new Schema({
  osmId: { type: String, required: true },
  name: { type: String, required: true },
  place: { type: String },
  geometry: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  properties: { type: Schema.Types.Mixed },
});

ZoneSchema.index({ geometry: '2dsphere' });

export const Zone: Model<IZone> =
  mongoose.models?.Zone || mongoose.model<IZone>('Zone', ZoneSchema, 'zones');
