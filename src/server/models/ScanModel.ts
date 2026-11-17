import mongoose, { Schema } from 'mongoose';
import type { RiskBand, ScanFileType } from '../../types/forensics.ts';

export interface ScanDocument {
  _id: string;
  ownerSessionHash: string;
  fileType: ScanFileType;
  fieldsFound: Record<string, boolean>;
  riskScore: number;
  band: RiskBand;
  scoringVersion: string;
  deductions: string[];
  createdAt: Date;
  expiresAt: Date;
}

const ScanSchema = new Schema<ScanDocument>(
  {
    _id: { type: String, required: true },
    ownerSessionHash: { type: String, required: true, index: true },
    fileType: {
      type: String,
      enum: ['image', 'pdf', 'text', 'website'],
      required: true,
    },
    fieldsFound: {
      type: Map,
      of: Boolean,
      default: {},
    },
    riskScore: { type: Number, required: true, min: 0, max: 100 },
    band: {
      type: String,
      enum: ['LOW', 'EXPOSED', 'HIGH', 'CRITICAL'],
      required: true,
    },
    scoringVersion: { type: String, required: true },
    deductions: { type: [String], default: [] },
    createdAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: 'scans',
    versionKey: false,
  }
);

// TTL index on createdAt: 7200 seconds (2 hours)
ScanSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });

export const ScanModel =
  (mongoose.models.Scan as mongoose.Model<ScanDocument>) ||
  mongoose.model<ScanDocument>('Scan', ScanSchema);
