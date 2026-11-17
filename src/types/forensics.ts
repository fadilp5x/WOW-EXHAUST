export type ScanFileType = 'image' | 'pdf' | 'text' | 'website';

export type RiskBand = 'LOW' | 'EXPOSED' | 'HIGH' | 'CRITICAL';

export type ExposureCategory =
  | 'WHERE'
  | 'WHEN'
  | 'DEVICE'
  | 'OWNER SIGNALS'
  | 'SOFTWARE'
  | 'DOCUMENT'
  | 'STYLE';

export type ScanStatus =
  | 'idle'
  | 'ready'
  | 'processing'
  | 'revealing'
  | 'waiting_ai'
  | 'complete'
  | 'cancelled'
  | 'error';

export type AgentXState =
  | 'STANDBY'
  | 'SCANNING'
  | 'FINDING DETECTED'
  | 'ANALYZING'
  | 'EXPLAINING'
  | 'FIX AVAILABLE'
  | 'COMPLETE';

export type DefenderActionTarget =
  | 'scrub_location'
  | 'scrub_document'
  | 'scrub_file'
  | 'normalize_text'
  | 'review_visual'
  | 'none';

export interface ScanStageEntry {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'skipped' | 'not_present' | 'error';
  detail?: string;
}

export interface ScoreContribution {
  id: string;
  label: string;
  points: number;
  sourceTag: string;
  present: boolean;
}

export interface RiskScoreResult {
  score: number;
  band: RiskBand;
  statusWord: 'PROTECTED' | 'VULNERABLE';
  scoringVersion: string;
  methodologyNote: string;
  contributions: ScoreContribution[];
}

export interface ForensicFinding {
  id: string;
  category: ExposureCategory;
  label: string;
  value: string;
  present: boolean;
  sourceTag: string;
  explanation: string;
  rawKey?: string;
}

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface ImageScanReport {
  kind: 'image';
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  isSample: boolean;
  sampleLabel?: string;
  previewUrl?: string;
  gps: GpsCoordinates | null;
  findings: ForensicFinding[];
  rawMetadata: Record<string, unknown>;
  fieldsFound: Record<string, boolean>;
  risk: RiskScoreResult;
  hasNoExifMessage: boolean;
  scannedAt: string;
}

export interface PdfStructuralFlags {
  incrementalUpdatesCount: number;
  hasIncrementalUpdates: boolean;
  hasEmbeddedFiles: boolean;
  hasAnnotations: boolean;
  hasFormFields: boolean;
  hasDigitalSignatures: boolean;
}

export interface PdfScanReport {
  kind: 'pdf';
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  isSample: boolean;
  sampleLabel?: string;
  findings: ForensicFinding[];
  structuralFlags: PdfStructuralFlags;
  rawMetadata: Record<string, unknown>;
  fieldsFound: Record<string, boolean>;
  risk: RiskScoreResult;
  revisionNotice: string;
  scannedAt: string;
}

export interface TextMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  meanSentenceLength: number;
  sentenceLengthVariance: number;
  lexicalDiversity: number;
  functionWordRatio: number;
  topFunctionWords: Array<{ word: string; count: number }>;
  punctuationPer100Words: number;
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  meanParagraphLength: number;
  allCapsWordRatio: number;
  titleCaseRatio: number;
  smartQuoteCount: number;
  nonBreakingSpaceCount: number;
  unusualWhitespaceCount: number;
  emojiCount: number;
}

export interface TextScanReport {
  kind: 'text';
  id: string;
  sourceLabel: string;
  charCount: number;
  tooShortForMetrics: boolean;
  isSample: boolean;
  sampleLabel?: string;
  metrics: TextMetrics;
  patternStrengthIndex: number;
  patternBand: string;
  interpretationNotice: string;
  normalizedText: string;
  normalizationChanges: string[];
  findings: ForensicFinding[];
  fieldsFound: Record<string, boolean>;
  scannedAt: string;
}

export type AnyScanReport = ImageScanReport | PdfScanReport | TextScanReport;

export interface Deduction {
  findingId: string;
  evidenceField: string;
  observation: string;
  implication: string;
  uncertainty: string;
  mitigation: string;
  source: 'gemini' | 'deterministic';
  // V4 beginner-friendly structured Defender card fields
  whatWeFound?: string;
  whatItMeans?: string;
  whyItMatters?: string;
  howToFix?: string;
  actionLabel?: string;
  actionTarget?: DefenderActionTarget;
  priorityRank?: number;
}

export type VisualObservationCategory =
  | 'id_badge'
  | 'name_tag'
  | 'logo'
  | 'readable_text'
  | 'license_plate'
  | 'background_document'
  | 'screen_info'
  | 'other_visible_detail';

export interface VisualRegionBox {
  // Normalized 0..1000 coordinates [ymin, xmin, ymax, xmax]
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface VisualObservation {
  id: string;
  category: VisualObservationCategory;
  title: string;
  evidenceDescription: string;
  confidenceDescription: string;
  whyItMatters: string;
  suggestedMitigation: string;
  region?: VisualRegionBox;
}

export interface VisualInspectionResponse {
  available: boolean;
  provider: 'gemini' | 'unavailable';
  model?: string;
  observations: VisualObservation[];
  summaryNote: string;
  disclosure: string;
}

export interface ProofOfScrub {
  originalScore: number;
  cleanedScore: number;
  originalBand: RiskBand;
  cleanedBand: RiskBand;
  originalMetadataCount: number;
  remainingMetadataCount: number;
  removedFields: string[];
  remainingFields: string[];
  verifiedAt: string;
  processingMethod: string;
  knownLimitations: string[];
  cleanedFileName: string;
  cleanedFileSize: number;
  cleanedMimeType: string;
  cleanedBlobUrl?: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  stage: 'load' | 'parse' | 'score' | 'scrub' | 'generate' | 'verify';
}

export interface SavedScanSummary {
  id: string;
  fileType: ScanFileType;
  fieldsFound: Record<string, boolean>;
  riskScore: number;
  band: RiskBand;
  scoringVersion: string;
  deductions: string[];
  createdAt: string;
  expiresAt: string;
}

export interface WebsiteSummaryReport {
  url: string;
  finalUrl: string;
  httpsAvailable: boolean;
  redirectCount: number;
  statusCode: number;
  securityHeaders: Record<string, string | null>;
  cookieCount: number;
  cookieNotes: string[];
  pageTitle: string | null;
  metaDescription: string | null;
  techIndicators: string[];
  thirdPartyHosts: string[];
  robotsTxtPresent: boolean;
  securityTxtPresent: boolean;
  inspectedAt: string;
}
