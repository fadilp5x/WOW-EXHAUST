import crypto from 'node:crypto';
import mongoose from 'mongoose';
import type { RiskBand, SavedScanSummary, ScanFileType } from '../../types/forensics.ts';
import { ScanModel } from '../models/ScanModel.ts';

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface DatabaseStatus {
  mode: 'mongodb' | 'ephemeral-memory';
  databaseConnected: boolean;
  ttlIndexVerified: boolean;
  ttlSeconds: number;
  lastError: string | null;
}

interface MemoryScanRecord {
  id: string;
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

const memoryStore = new Map<string, MemoryScanRecord>();

let dbStatus: DatabaseStatus = {
  mode: 'ephemeral-memory',
  databaseConnected: false,
  ttlIndexVerified: false,
  ttlSeconds: 7200,
  lastError: null,
};

let initPromise: Promise<void> | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

export function getDatabaseStatus(): DatabaseStatus {
  return { ...dbStatus };
}

export function isRecordExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() >= TWO_HOURS_MS;
}

async function purgeExpiredRecords(): Promise<void> {
  const cutoff = new Date(Date.now() - TWO_HOURS_MS);
  for (const [id, rec] of memoryStore.entries()) {
    if (isRecordExpired(rec.createdAt)) {
      memoryStore.delete(id);
    }
  }
  if (dbStatus.databaseConnected) {
    try {
      await ScanModel.deleteMany({ createdAt: { $lte: cutoff } });
    } catch {
      // Non-fatal cleanup retry on next cycle
    }
  }
}

export async function initDatabase(): Promise<DatabaseStatus> {
  if (initPromise) {
    await initPromise;
    return getDatabaseStatus();
  }

  initPromise = (async () => {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
      dbStatus = {
        mode: 'ephemeral-memory',
        databaseConnected: false,
        ttlIndexVerified: false,
        ttlSeconds: 7200,
        lastError: 'MONGODB_URI not configured; using server session memory.',
      };
      return;
    }

    try {
      await mongoose.connect(uri, {
        dbName: 'exhaust',
        serverSelectionTimeoutMS: 5000,
      });

      // Ensure and verify TTL index on createdAt (expireAfterSeconds: 7200)
      await ScanModel.syncIndexes();
      const indexes = await ScanModel.collection.indexes();
      const ttlIdx = indexes.find(
        (idx) =>
          idx.key &&
          (idx.key as Record<string, unknown>).createdAt === 1 &&
          idx.expireAfterSeconds === 7200
      );

      dbStatus = {
        mode: 'mongodb',
        databaseConnected: true,
        ttlIndexVerified: Boolean(ttlIdx),
        ttlSeconds: 7200,
        lastError: ttlIdx ? null : 'TTL index missing after syncIndexes.',
      };
    } catch (err) {
      dbStatus = {
        mode: 'ephemeral-memory',
        databaseConnected: false,
        ttlIndexVerified: false,
        ttlSeconds: 7200,
        lastError: err instanceof Error ? err.message : 'MongoDB connection failed',
      };
    }
  })();

  await initPromise;

  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      void purgeExpiredRecords();
    }, 5 * 60 * 1000);
    cleanupTimer.unref();
  }

  return getDatabaseStatus();
}

export async function saveScanSummary(input: {
  ownerSessionHash: string;
  fileType: ScanFileType;
  fieldsFound: Record<string, boolean>;
  riskScore: number;
  band: RiskBand;
  scoringVersion: string;
  deductions: string[];
  createdAt?: Date;
}): Promise<SavedScanSummary> {
  const id = crypto.randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + TWO_HOURS_MS);

  if (dbStatus.databaseConnected) {
    await ScanModel.create({
      _id: id,
      ownerSessionHash: input.ownerSessionHash,
      fileType: input.fileType,
      fieldsFound: input.fieldsFound,
      riskScore: input.riskScore,
      band: input.band,
      scoringVersion: input.scoringVersion,
      deductions: input.deductions,
      createdAt,
      expiresAt,
    });
  } else {
    memoryStore.set(id, {
      id,
      ownerSessionHash: input.ownerSessionHash,
      fileType: input.fileType,
      fieldsFound: input.fieldsFound,
      riskScore: input.riskScore,
      band: input.band,
      scoringVersion: input.scoringVersion,
      deductions: input.deductions,
      createdAt,
      expiresAt,
    });
  }

  return {
    id,
    fileType: input.fileType,
    fieldsFound: input.fieldsFound,
    riskScore: input.riskScore,
    band: input.band,
    scoringVersion: input.scoringVersion,
    deductions: input.deductions,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function listScanSummaries(
  ownerSessionHash: string,
  now: Date = new Date()
): Promise<SavedScanSummary[]> {
  const cutoff = new Date(now.getTime() - TWO_HOURS_MS);

  if (dbStatus.databaseConnected) {
    const docs = await ScanModel.find({
      ownerSessionHash,
      createdAt: { $gt: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return docs.map((d) => ({
      id: d._id,
      fileType: d.fileType,
      fieldsFound:
        d.fieldsFound instanceof Map
          ? Object.fromEntries(d.fieldsFound.entries())
          : (d.fieldsFound as Record<string, boolean>),
      riskScore: d.riskScore,
      band: d.band,
      scoringVersion: d.scoringVersion,
      deductions: d.deductions,
      createdAt: new Date(d.createdAt).toISOString(),
      expiresAt: new Date(d.expiresAt).toISOString(),
    }));
  }

  const out: SavedScanSummary[] = [];
  for (const rec of memoryStore.values()) {
    if (rec.ownerSessionHash !== ownerSessionHash) continue;
    if (isRecordExpired(rec.createdAt, now)) {
      memoryStore.delete(rec.id);
      continue;
    }
    out.push({
      id: rec.id,
      fileType: rec.fileType,
      fieldsFound: rec.fieldsFound,
      riskScore: rec.riskScore,
      band: rec.band,
      scoringVersion: rec.scoringVersion,
      deductions: rec.deductions,
      createdAt: rec.createdAt.toISOString(),
      expiresAt: rec.expiresAt.toISOString(),
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getScanSummaryById(
  id: string,
  ownerSessionHash: string,
  now: Date = new Date()
): Promise<{ status: 'found'; report: SavedScanSummary } | { status: 'not_found' } | { status: 'forbidden' } | { status: 'expired' }> {
  if (dbStatus.databaseConnected) {
    const doc = await ScanModel.findById(id).lean();
    if (!doc) return { status: 'not_found' };
    if (doc.ownerSessionHash !== ownerSessionHash) return { status: 'forbidden' };
    if (isRecordExpired(new Date(doc.createdAt), now)) return { status: 'expired' };

    return {
      status: 'found',
      report: {
        id: doc._id,
        fileType: doc.fileType,
        fieldsFound:
          doc.fieldsFound instanceof Map
            ? Object.fromEntries(doc.fieldsFound.entries())
            : (doc.fieldsFound as Record<string, boolean>),
        riskScore: doc.riskScore,
        band: doc.band,
        scoringVersion: doc.scoringVersion,
        deductions: doc.deductions,
        createdAt: new Date(doc.createdAt).toISOString(),
        expiresAt: new Date(doc.expiresAt).toISOString(),
      },
    };
  }

  const rec = memoryStore.get(id);
  if (!rec) return { status: 'not_found' };
  if (rec.ownerSessionHash !== ownerSessionHash) return { status: 'forbidden' };
  if (isRecordExpired(rec.createdAt, now)) {
    memoryStore.delete(id);
    return { status: 'expired' };
  }

  return {
    status: 'found',
    report: {
      id: rec.id,
      fileType: rec.fileType,
      fieldsFound: rec.fieldsFound,
      riskScore: rec.riskScore,
      band: rec.band,
      scoringVersion: rec.scoringVersion,
      deductions: rec.deductions,
      createdAt: rec.createdAt.toISOString(),
      expiresAt: rec.expiresAt.toISOString(),
    },
  };
}

export async function deleteScanSummary(
  id: string,
  ownerSessionHash: string
): Promise<'deleted' | 'not_found' | 'forbidden'> {
  if (dbStatus.databaseConnected) {
    const doc = await ScanModel.findById(id).lean();
    if (!doc) return 'not_found';
    if (doc.ownerSessionHash !== ownerSessionHash) return 'forbidden';
    await ScanModel.deleteOne({ _id: id, ownerSessionHash });
    return 'deleted';
  }

  const rec = memoryStore.get(id);
  if (!rec) return 'not_found';
  if (rec.ownerSessionHash !== ownerSessionHash) return 'forbidden';
  memoryStore.delete(id);
  return 'deleted';
}
