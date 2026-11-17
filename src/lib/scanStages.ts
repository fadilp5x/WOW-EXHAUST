import type { ScanStageEntry } from '../types/forensics';

export function createInitialImageStages(): ScanStageEntry[] {
  return [
    { id: 'receive', label: 'Receiving local input', status: 'pending' },
    { id: 'validate', label: 'Validating file type', status: 'pending' },
    { id: 'bytes', label: 'Reading file bytes', status: 'pending' },
    { id: 'exif', label: 'Extracting EXIF metadata', status: 'pending' },
    { id: 'location', label: 'Parsing available location fields', status: 'pending' },
    { id: 'device', label: 'Identifying device metadata', status: 'pending' },
    { id: 'score', label: 'Calculating exposure indicators', status: 'pending' },
    { id: 'graph', label: 'Preparing evidence relationships', status: 'pending' },
    { id: 'defender', label: 'Building Defender recommendations', status: 'pending' },
    { id: 'finalize', label: 'Finalizing report', status: 'pending' },
  ];
}

export function createInitialPdfStages(): ScanStageEntry[] {
  return [
    { id: 'open', label: 'Opening document', status: 'pending' },
    { id: 'structure', label: 'Reading document structure', status: 'pending' },
    { id: 'metadata', label: 'Extracting document metadata', status: 'pending' },
    { id: 'properties', label: 'Inspecting available properties', status: 'pending' },
    { id: 'score', label: 'Evaluating privacy exposure', status: 'pending' },
    { id: 'findings', label: 'Generating findings', status: 'pending' },
    { id: 'remediation', label: 'Preparing remediation options', status: 'pending' },
  ];
}

export function createInitialTextStages(): ScanStageEntry[] {
  return [
    { id: 'read', label: 'Reading text', status: 'pending' },
    { id: 'segment', label: 'Segmenting sentences', status: 'pending' },
    { id: 'lexical', label: 'Calculating lexical measures', status: 'pending' },
    { id: 'punctuation', label: 'Measuring punctuation patterns', status: 'pending' },
    { id: 'variation', label: 'Analyzing structural variation', status: 'pending' },
    { id: 'distinctiveness', label: 'Computing pattern distinctiveness', status: 'pending' },
    { id: 'explain', label: 'Preparing explanations', status: 'pending' },
  ];
}
