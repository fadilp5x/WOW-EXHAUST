import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  deleteScanSummary,
  getScanSummaryById,
  listScanSummaries,
  saveScanSummary,
  TWO_HOURS_MS,
} from '../../src/server/database/mongo';
import { ScanModel } from '../../src/server/models/ScanModel';
import { generateGroundedDeductions } from '../../src/server/geminiDeduce';
import { createApiRouter } from '../../src/server/routes/api';

test('7. Report session ownership isolation and 2-hour expiry enforcement', async () => {
  const ownerA = 'session_hash_alpha';
  const ownerB = 'session_hash_bravo';

  const saved = await saveScanSummary({
    ownerSessionHash: ownerA,
    fileType: 'image',
    fieldsFound: { gps: true, device: true },
    riskScore: 50,
    band: 'EXPOSED',
    scoringVersion: 'exhaust-v3.1.0',
    deductions: ['GPS found'],
  });

  // Owner A can retrieve
  const foundA = await getScanSummaryById(saved.id, ownerA);
  assert.equal(foundA.status, 'found');

  // Owner B is forbidden
  const deniedB = await getScanSummaryById(saved.id, ownerB);
  assert.equal(deniedB.status, 'forbidden');

  // List only returns owner A's records
  const listB = await listScanSummaries(ownerB);
  assert.equal(listB.some((r) => r.id === saved.id), false);

  // Expired report (> 2 hours old) is refused
  const expiredReport = await saveScanSummary({
    ownerSessionHash: ownerA,
    fileType: 'pdf',
    fieldsFound: { pdf_author: true },
    riskScore: 20,
    band: 'LOW',
    scoringVersion: 'exhaust-v3.1.0',
    deductions: ['Author found'],
    createdAt: new Date(Date.now() - TWO_HOURS_MS - 10_000),
  });

  const expiredCheck = await getScanSummaryById(expiredReport.id, ownerA);
  assert.equal(expiredCheck.status, 'expired');

  // Cleanup
  await deleteScanSummary(saved.id, ownerA);
});

test('8. Mongoose ScanModel schema registers 7200s TTL index on createdAt', () => {
  const indexes = ScanModel.schema.indexes();
  const ttlIndex = indexes.find(
    ([fields, options]) =>
      fields.createdAt === 1 && options?.expireAfterSeconds === 7200
  );
  assert.ok(ttlIndex, 'Expected ScanSchema to declare expireAfterSeconds: 7200 on createdAt');
});

test('9. Gemini deduction engine falls back deterministically when key is missing', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const res = await generateGroundedDeductions({
    consentGranted: true,
    fileType: 'image',
    riskScore: 40,
    band: 'EXPOSED',
    findings: [
      {
        findingId: 'where_gps',
        category: 'WHERE',
        label: 'GPS Coordinates',
        sourceTag: 'EXIF / GPSLatitude & GPSLongitude',
        present: true,
        redactedSummary: 'Geographic coordinates present.',
      },
    ],
  });

  process.env.GEMINI_API_KEY = prevKey;

  assert.equal(res.provider, 'deterministic-fallback');
  assert.equal(res.deductions.length, 1);
  assert.equal(res.deductions[0].findingId, 'where_gps');
  assert.equal(res.deductions[0].source, 'deterministic');
});

test('10. /api/location/reverse validates coordinate bounds and returns 400 on invalid coords', async () => {
  const app = express();
  app.use('/api', createApiRouter());
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const outOfRange = await fetch(`http://127.0.0.1:${port}/api/location/reverse?lat=120&lon=45`);
    assert.equal(outOfRange.status, 400);

    const nonNumeric = await fetch(`http://127.0.0.1:${port}/api/location/reverse?lat=abc&lon=10`);
    assert.equal(nonNumeric.status, 400);

    const invalidTile = await fetch(`http://127.0.0.1:${port}/api/location/tile/99/1/1.png`);
    assert.equal(invalidTile.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
