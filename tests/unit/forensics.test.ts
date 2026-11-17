import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { analyzeImageBytes } from '../../src/lib/imageForensics';
import { analyzePdfBytes } from '../../src/lib/pdfForensics';
import { analyzeText, normalizeTextCopy } from '../../src/lib/textFingerprint';
import {
  scoreImageFindings,
  scorePdfFindings,
  recalculateServerScore,
} from '../../src/lib/scoring';
import { scrubPdfAndVerify } from '../../src/lib/scrubber';
import { buildDeterministicDeductions } from '../../src/lib/deductions';
import {
  injectExifIntoJpeg,
  MINIMAL_JPEG_BYTES,
  SAMPLE_TEXT_POST,
} from '../../src/lib/samples';

test('1. Image with GPS produces GPS finding and exact weighted exposure score', async () => {
  const bytes = injectExifIntoJpeg(MINIMAL_JPEG_BYTES, {
    make: 'Apple',
    model: 'iPhone 15 Pro',
    software: 'iOS 18.1',
    artist: 'Test User',
    dateTimeOriginal: '2026:10:14 18:42:19',
    bodySerialNumber: 'SER-9911',
    gps: { latitude: 37.774929, longitude: -122.419416 },
  });

  const report = await analyzeImageBytes(bytes, {
    fileName: 'gps_test.jpg',
    fileSize: bytes.byteLength,
    mimeType: 'image/jpeg',
  });

  assert.ok(report.gps, 'Expected GPS coordinates to be extracted');
  assert.ok(Math.abs(report.gps!.latitude - 37.7749) < 0.01);
  assert.ok(Math.abs(report.gps!.longitude - -122.4194) < 0.01);
  assert.equal(report.fieldsFound.gps, true);
  assert.equal(report.fieldsFound.device, true);
  assert.equal(report.fieldsFound.timestamp, true);
  assert.equal(report.fieldsFound.owner, true);
  assert.equal(report.fieldsFound.software, true);
  assert.equal(report.fieldsFound.serial, true);
  assert.equal(report.risk.score, 100);
  assert.equal(report.risk.band, 'CRITICAL');
  assert.equal(report.risk.statusWord, 'VULNERABLE');
});

test('2. Image without EXIF metadata reports NOT PRESENT and zero score', async () => {
  const report = await analyzeImageBytes(MINIMAL_JPEG_BYTES, {
    fileName: 'stripped.jpg',
    fileSize: MINIMAL_JPEG_BYTES.byteLength,
    mimeType: 'image/jpeg',
  });

  assert.equal(report.gps, null);
  assert.equal(report.risk.score, 0);
  assert.equal(report.risk.band, 'LOW');
  assert.equal(report.risk.statusWord, 'PROTECTED');
  assert.equal(report.hasNoExifMessage, true);
  for (const finding of report.findings) {
    assert.equal(finding.present, false);
    assert.equal(finding.value, 'NOT PRESENT');
  }
});

test('3. Exact documented image and PDF risk scoring weights', () => {
  const gpsOnly = scoreImageFindings({
    hasGps: true,
    hasCameraSerial: false,
    hasExactTimestamp: false,
    hasDeviceMakeModel: false,
    hasOwnerOrCopyright: false,
    hasSoftwareTrace: false,
  });
  assert.equal(gpsOnly.score, 40);
  assert.equal(gpsOnly.band, 'EXPOSED');

  const pdfAuthorAndTimestamps = scorePdfFindings({
    hasAuthor: true,
    hasCreatorOrProducer: false,
    hasTimestamps: true,
    hasKeywords: false,
    hasIncrementalUpdateIndicators: false,
  });
  assert.equal(pdfAuthorAndTimestamps.score, 30);
  assert.equal(pdfAuthorAndTimestamps.band, 'EXPOSED');

  const serverRecalc = recalculateServerScore('image', {
    gps: true,
    device: true,
    timestamp: true,
  });
  assert.equal(serverRecalc.riskScore, 60);
  assert.equal(serverRecalc.band, 'HIGH');
});

test('4. PDF author metadata is extracted and PDF scrubbing reduces metadata and warns honestly', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  doc.setAuthor('Alice Researcher');
  doc.setCreator('Test Suite Writer');
  doc.setProducer('PDF Engine');
  doc.setKeywords(['confidential', 'draft']);
  doc.setCreationDate(new Date('2026-10-01T10:00:00Z'));

  const bytes = await doc.save({ useObjectStreams: false });
  const report = await analyzePdfBytes(bytes, {
    fileName: 'sample.pdf',
    fileSize: bytes.byteLength,
  });

  assert.equal(report.fieldsFound.pdf_author, true);
  assert.equal(report.fieldsFound.pdf_creator, true);
  assert.equal(report.fieldsFound.pdf_timestamps, true);
  assert.equal(report.fieldsFound.pdf_keywords, true);
  assert.equal(report.risk.score, 45);
  assert.match(report.revisionNotice, /Full revision history is not available/i);

  const { afterReport, proof } = await scrubPdfAndVerify(bytes, report);
  assert.equal(afterReport.fieldsFound.pdf_author, false);
  assert.equal(afterReport.risk.score, 0);
  assert.ok(proof.removedFields.length > 0);
  assert.ok(proof.knownLimitations.some((l) => l.includes('NOT proof')));
});

test('5. Text pattern metrics are deterministic and clean-copy normalizes formatting', () => {
  const r1 = analyzeText(SAMPLE_TEXT_POST);
  const r2 = analyzeText(SAMPLE_TEXT_POST);

  assert.equal(r1.patternStrengthIndex, r2.patternStrengthIndex);
  assert.deepEqual(r1.metrics, r2.metrics);
  assert.ok(r1.metrics.smartQuoteCount > 0);
  assert.ok(r1.metrics.nonBreakingSpaceCount > 0);
  assert.match(r1.interpretationNotice, /do not prove authorship, identity, or AI use/i);

  const normalized = normalizeTextCopy(SAMPLE_TEXT_POST);
  assert.equal(normalized.normalizedText.includes('\u00A0'), false);
  assert.equal(normalized.normalizedText.includes('\u201C'), false);
  assert.ok(normalized.changes.length >= 2);
});

test('6. Deterministic REDTEAM deductions only reference present findings', async () => {
  const bytes = injectExifIntoJpeg(MINIMAL_JPEG_BYTES, {
    make: 'Canon',
    model: 'EOS R5',
  });
  const report = await analyzeImageBytes(bytes, {
    fileName: 'canon_only.jpg',
    fileSize: bytes.byteLength,
    mimeType: 'image/jpeg',
  });

  const deductions = buildDeterministicDeductions(report);
  assert.equal(deductions.length, 1);
  assert.equal(deductions[0].findingId, 'device_model');
  assert.equal(deductions.some((d) => d.findingId === 'where_gps'), false);
});
