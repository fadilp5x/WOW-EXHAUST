import test from 'node:test';
import assert from 'node:assert/strict';
import { getRiskThemeForScore, resolveBandFromScore } from '../../src/lib/riskTheme';
import {
  createInitialImageStages,
  createInitialPdfStages,
  createInitialTextStages,
} from '../../src/lib/scanStages';
import {
  answerAgentXQuestion,
  buildAgentXPrimaryBriefing,
  deriveAgentXState,
} from '../../src/lib/agentX';
import { analyzeImageBytes } from '../../src/lib/imageForensics';
import { analyzeText } from '../../src/lib/textFingerprint';
import { buildDeterministicDeductions } from '../../src/lib/deductions';
import {
  createSampleResumePdf,
  injectExifIntoJpeg,
  MINIMAL_JPEG_BYTES,
} from '../../src/lib/samples';

test('V4-1. Unified risk bands and theme tokens resolve exact score cutoffs', () => {
  assert.equal(resolveBandFromScore(0), 'LOW');
  assert.equal(resolveBandFromScore(24), 'LOW');
  assert.equal(resolveBandFromScore(25), 'EXPOSED');
  assert.equal(resolveBandFromScore(54), 'EXPOSED');
  assert.equal(resolveBandFromScore(55), 'HIGH');
  assert.equal(resolveBandFromScore(79), 'HIGH');
  assert.equal(resolveBandFromScore(80), 'CRITICAL');
  assert.equal(resolveBandFromScore(100), 'CRITICAL');

  assert.equal(getRiskThemeForScore(0, 'idle').tone, 'IDLE');
  assert.equal(getRiskThemeForScore(85, 'text').tone, 'PATTERN');
  assert.equal(getRiskThemeForScore(90, 'image').tone, 'CRITICAL');
  assert.equal(getRiskThemeForScore(10, 'pdf').tone, 'LOW');
});

test('V4-2. Stage pipelines define accurate step counts per input type', () => {
  assert.equal(createInitialImageStages().length, 10);
  assert.equal(createInitialPdfStages().length, 7);
  assert.equal(createInitialTextStages().length, 7);
});

test('V4-3. Short text (< 15 words) flags limited sample cleanly and never crashes', () => {
  const short = analyzeText('Short sample post.');
  assert.equal(short.tooShortForMetrics, true);
  assert.equal(short.patternBand, 'LIMITED SAMPLE (<15 WORDS)');

  const empty = analyzeText('   ');
  assert.equal(empty.metrics.wordCount, 0);
  assert.equal(empty.patternStrengthIndex, 0);
  assert.equal(empty.patternBand, 'EMPTY INPUT');
});

test('V4-4. Agent X state derivation & grounded Q&A never fabricate unparsed GPS', async () => {
  assert.equal(deriveAgentXState('idle', null, false), 'STANDBY');
  assert.equal(deriveAgentXState('processing', null, false), 'SCANNING');

  const noGpsBytes = injectExifIntoJpeg(MINIMAL_JPEG_BYTES, {
    make: 'SONY',
    model: 'ILCE-7M4',
  });
  const noGpsReport = await analyzeImageBytes(noGpsBytes, {
    fileName: 'device_only.jpg',
    fileSize: noGpsBytes.byteLength,
    mimeType: 'image/jpeg',
  });

  const briefing = buildAgentXPrimaryBriefing(noGpsReport);
  assert.match(briefing, /No GPS metadata was detected/i);

  const whatFound = answerAgentXQuestion('what_found', noGpsReport);
  assert.match(whatFound, /SONY/i);
  assert.equal(whatFound.includes('37.77'), false);

  const postScrub = buildAgentXPrimaryBriefing(noGpsReport, {
    originalScore: 100,
    cleanedScore: 0,
    originalBand: 'CRITICAL',
    cleanedBand: 'LOW',
    originalMetadataCount: 6,
    remainingMetadataCount: 0,
    removedFields: ['Location / GPS Coordinates'],
    remainingFields: [],
    verifiedAt: new Date().toISOString(),
    processingMethod: 'Canvas re-encoding',
    knownLimitations: [],
    cleanedFileName: 'clean.jpg',
    cleanedFileSize: 1024,
    cleanedMimeType: 'image/jpeg',
  });
  assert.match(postScrub, /no longer contains the GPS metadata/i);
});

test('V4-5. Defender cards include beginner-friendly structure sorted urgent-first', async () => {
  const bytes = injectExifIntoJpeg(MINIMAL_JPEG_BYTES, {
    make: 'Apple',
    model: 'iPhone 15 Pro',
    software: 'iOS 18.1',
    gps: { latitude: 37.7749, longitude: -122.4194 },
  });
  const report = await analyzeImageBytes(bytes, {
    fileName: 'gps_order.jpg',
    fileSize: bytes.byteLength,
    mimeType: 'image/jpeg',
  });

  const cards = buildDeterministicDeductions(report);
  assert.ok(cards.length >= 2);
  assert.equal(cards[0].findingId, 'where_gps');
  assert.ok(cards[0].whatWeFound && cards[0].whatItMeans && cards[0].whyItMatters && cards[0].howToFix);
  assert.equal(cards[0].actionTarget, 'scrub_location');
});

test('V4-6. Sample Resume PDF builds a real 2-page PDF binary', async () => {
  const file = await createSampleResumePdf();
  const bytes = new Uint8Array(await file.arrayBuffer());
  assert.ok(bytes.byteLength > 500);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('%PDF-'));
});
