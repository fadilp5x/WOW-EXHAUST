import type {
  RiskBand,
  RiskScoreResult,
  ScoreContribution,
} from '../types/forensics.ts';

export const SCORING_VERSION = 'exhaust-v3.1.0';

export function getRiskBand(score: number): RiskBand {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 25) return 'EXPOSED';
  return 'LOW';
}

export function getStatusWord(band: RiskBand): 'PROTECTED' | 'VULNERABLE' {
  return band === 'LOW' ? 'PROTECTED' : 'VULNERABLE';
}

export interface ImageScoringInputs {
  hasGps: boolean;
  hasCameraSerial: boolean;
  hasExactTimestamp: boolean;
  hasDeviceMakeModel: boolean;
  hasOwnerOrCopyright: boolean;
  hasSoftwareTrace: boolean;
}

/**
 * Exact documented EXHAUST V3 image exposure scoring formula (max 100):
 * - GPS coordinates: +40
 * - Camera serial: +15
 * - Exact capture timestamp: +10
 * - Device make/model: +10
 * - Owner, artist, or copyright identifier: +15
 * - Software trace: +10
 */
export function scoreImageFindings(inputs: ImageScoringInputs): RiskScoreResult {
  const contributions: ScoreContribution[] = [
    {
      id: 'gps',
      label: 'GPS coordinates',
      points: 40,
      sourceTag: 'EXIF / GPSLatitude & GPSLongitude',
      present: inputs.hasGps,
    },
    {
      id: 'owner',
      label: 'Owner, artist, or copyright identifier',
      points: 15,
      sourceTag: 'EXIF / Artist, Copyright, XMP:Creator',
      present: inputs.hasOwnerOrCopyright,
    },
    {
      id: 'serial',
      label: 'Camera or lens serial identifier',
      points: 15,
      sourceTag: 'EXIF / BodySerialNumber, SerialNumber',
      present: inputs.hasCameraSerial,
    },
    {
      id: 'timestamp',
      label: 'Exact capture timestamp',
      points: 10,
      sourceTag: 'EXIF / DateTimeOriginal',
      present: inputs.hasExactTimestamp,
    },
    {
      id: 'device',
      label: 'Device make and model',
      points: 10,
      sourceTag: 'EXIF / Make & Model',
      present: inputs.hasDeviceMakeModel,
    },
    {
      id: 'software',
      label: 'Editing or OS software trace',
      points: 10,
      sourceTag: 'EXIF / Software',
      present: inputs.hasSoftwareTrace,
    },
  ];

  const rawScore = contributions.reduce(
    (sum, item) => (item.present ? sum + item.points : sum),
    0
  );
  const score = Math.min(100, Math.max(0, rawScore));
  const band = getRiskBand(score);

  return {
    score,
    band,
    statusWord: getStatusWord(band),
    scoringVersion: SCORING_VERSION,
    methodologyNote:
      'Product-defined exposure heuristic summing documented metadata weights (max 100), not a calibrated risk probability.',
    contributions,
  };
}

export interface PdfScoringInputs {
  hasAuthor: boolean;
  hasCreatorOrProducer: boolean;
  hasTimestamps: boolean;
  hasKeywords: boolean;
  hasIncrementalUpdateIndicators: boolean;
}

/**
 * Explicit versioned EXHAUST V3 PDF exposure scoring formula (max 55):
 * - Author: +20
 * - Creator/producer details: +10
 * - Creation and modification timestamps: +10
 * - Keywords: +5
 * - Reliable incremental-update indicators (e.g. multiple %%EOF markers): +10
 */
export function scorePdfFindings(inputs: PdfScoringInputs): RiskScoreResult {
  const contributions: ScoreContribution[] = [
    {
      id: 'pdf_author',
      label: 'Document Author metadata',
      points: 20,
      sourceTag: 'PDF Info / Author',
      present: inputs.hasAuthor,
    },
    {
      id: 'pdf_creator',
      label: 'Creator / Producer application details',
      points: 10,
      sourceTag: 'PDF Info / Creator & Producer',
      present: inputs.hasCreatorOrProducer,
    },
    {
      id: 'pdf_timestamps',
      label: 'Creation / Modification timestamps',
      points: 10,
      sourceTag: 'PDF Info / CreationDate & ModDate',
      present: inputs.hasTimestamps,
    },
    {
      id: 'pdf_keywords',
      label: 'Embedded Keywords',
      points: 5,
      sourceTag: 'PDF Info / Keywords',
      present: inputs.hasKeywords,
    },
    {
      id: 'pdf_incremental',
      label: 'Multiple PDF EOF / incremental-update markers',
      points: 10,
      sourceTag: 'PDF Structure / %%EOF count > 1',
      present: inputs.hasIncrementalUpdateIndicators,
    },
  ];

  const rawScore = contributions.reduce(
    (sum, item) => (item.present ? sum + item.points : sum),
    0
  );
  const score = Math.min(100, Math.max(0, rawScore));
  const band = getRiskBand(score);

  return {
    score,
    band,
    statusWord: getStatusWord(band),
    scoringVersion: SCORING_VERSION,
    methodologyNote:
      'Explicit PDF metadata heuristic (max 55). Differing dates alone do not prove revision history; structural %%EOF markers are checked separately.',
    contributions,
  };
}

/**
 * Server-side deterministic score recalculation from boolean fieldsFound map.
 * Never trusts client-submitted numeric scores.
 */
export function recalculateServerScore(
  fileType: 'image' | 'pdf' | 'text' | 'website',
  fieldsFound: Record<string, boolean>
): { riskScore: number; band: RiskBand } {
  if (fileType === 'image') {
    const res = scoreImageFindings({
      hasGps: Boolean(fieldsFound.gps),
      hasCameraSerial: Boolean(fieldsFound.serial),
      hasExactTimestamp: Boolean(fieldsFound.timestamp),
      hasDeviceMakeModel: Boolean(fieldsFound.device),
      hasOwnerOrCopyright: Boolean(fieldsFound.owner),
      hasSoftwareTrace: Boolean(fieldsFound.software),
    });
    return { riskScore: res.score, band: res.band };
  }

  if (fileType === 'pdf') {
    const res = scorePdfFindings({
      hasAuthor: Boolean(fieldsFound.pdf_author),
      hasCreatorOrProducer: Boolean(fieldsFound.pdf_creator),
      hasTimestamps: Boolean(fieldsFound.pdf_timestamps),
      hasKeywords: Boolean(fieldsFound.pdf_keywords),
      hasIncrementalUpdateIndicators: Boolean(fieldsFound.pdf_incremental),
    });
    return { riskScore: res.score, band: res.band };
  }

  // For text / website summaries, compute bounded informational index
  const activeCount = Object.values(fieldsFound).filter(Boolean).length;
  const bounded = Math.min(100, activeCount * 15);
  return { riskScore: bounded, band: getRiskBand(bounded) };
}
