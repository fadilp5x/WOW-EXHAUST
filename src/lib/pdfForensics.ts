import { PDFDocument } from 'pdf-lib';
import type {
  ForensicFinding,
  PdfScanReport,
  PdfStructuralFlags,
} from '../types/forensics';
import { scorePdfFindings } from './scoring';

function cleanPdfText(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatPdfDate(d: Date | undefined): string | null {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function inspectPdfStructureBytes(bytes: Uint8Array): PdfStructuralFlags {
  // Decode latin1 safely to inspect ASCII PDF structural tokens without corrupting offsets
  let text = '';
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    text += String.fromCharCode(...slice);
  }

  const eofMatches = text.match(/%%EOF/g);
  const incrementalUpdatesCount = eofMatches ? eofMatches.length : 0;

  return {
    incrementalUpdatesCount,
    hasIncrementalUpdates: incrementalUpdatesCount > 1,
    hasEmbeddedFiles: /\/EmbeddedFiles\b/.test(text),
    hasAnnotations: /\/Annots\b/.test(text),
    hasFormFields: /\/AcroForm\b/.test(text),
    hasDigitalSignatures: /\/Type\s*\/Sig\b|\/ByteRange\b/.test(text),
  };
}

export async function analyzePdfBytes(
  bytes: Uint8Array,
  meta: {
    fileName: string;
    fileSize: number;
    isSample?: boolean;
    sampleLabel?: string;
  }
): Promise<PdfScanReport> {
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const title = cleanPdfText(pdfDoc.getTitle());
  const author = cleanPdfText(pdfDoc.getAuthor());
  const subject = cleanPdfText(pdfDoc.getSubject());
  const keywords = cleanPdfText(pdfDoc.getKeywords());
  const creator = cleanPdfText(pdfDoc.getCreator());
  const producer = cleanPdfText(pdfDoc.getProducer());
  const creationDate = formatPdfDate(pdfDoc.getCreationDate());
  const modificationDate = formatPdfDate(pdfDoc.getModificationDate());
  const pageCount = pdfDoc.getPageCount();

  const structuralFlags = inspectPdfStructureBytes(bytes);

  const creatorProducer = [creator, producer].filter(Boolean).join(' · ') || null;
  const timestamps = [
    creationDate ? `Created: ${creationDate}` : null,
    modificationDate ? `Modified: ${modificationDate}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || null;

  const findings: ForensicFinding[] = [
    {
      id: 'pdf_author',
      category: 'OWNER SIGNALS',
      label: 'Document Author',
      value: author ?? 'NOT PRESENT',
      present: Boolean(author),
      sourceTag: 'PDF Info / Author',
      explanation: author
        ? 'The PDF Info dictionary contains an explicit Author field, often populated automatically from the creator OS account or office suite.'
        : 'No Author field was found in the PDF Info dictionary.',
      rawKey: 'Author',
    },
    {
      id: 'pdf_title_subject',
      category: 'DOCUMENT',
      label: 'Title & Subject',
      value: [title, subject].filter(Boolean).join(' · ') || 'NOT PRESENT',
      present: Boolean(title || subject),
      sourceTag: 'PDF Info / Title & Subject',
      explanation:
        title || subject
          ? 'Document title or subject strings can reveal internal project names or draft titles.'
          : 'No Title or Subject metadata was found.',
      rawKey: 'Title',
    },
    {
      id: 'pdf_creator',
      category: 'SOFTWARE',
      label: 'Creator & Producer Software',
      value: creatorProducer ?? 'NOT PRESENT',
      present: Boolean(creatorProducer),
      sourceTag: 'PDF Info / Creator & Producer',
      explanation: creatorProducer
        ? 'Reveals the authoring application and PDF generation library used to build the file.'
        : 'No Creator or Producer metadata was found.',
      rawKey: 'Creator',
    },
    {
      id: 'pdf_timestamps',
      category: 'WHEN',
      label: 'Creation & Modification Dates',
      value: timestamps ?? 'NOT PRESENT',
      present: Boolean(timestamps),
      sourceTag: 'PDF Info / CreationDate & ModDate',
      explanation: timestamps
        ? 'Records when the PDF was generated or updated. Note: differing dates alone do not reconstruct historical content changes.'
        : 'No CreationDate or ModDate metadata was found.',
      rawKey: 'CreationDate',
    },
    {
      id: 'pdf_keywords',
      category: 'DOCUMENT',
      label: 'Document Keywords',
      value: keywords ?? 'NOT PRESENT',
      present: Boolean(keywords),
      sourceTag: 'PDF Info / Keywords',
      explanation: keywords
        ? 'Embedded index keywords travel inside the file header.'
        : 'No Keywords metadata was found.',
      rawKey: 'Keywords',
    },
    {
      id: 'pdf_incremental',
      category: 'DOCUMENT',
      label: 'Incremental Update Markers',
      value: structuralFlags.hasIncrementalUpdates
        ? `${structuralFlags.incrementalUpdatesCount} %%EOF markers detected`
        : structuralFlags.incrementalUpdatesCount === 1
          ? 'Single %%EOF marker (no incremental append detected)'
          : 'NOT PRESENT',
      present: structuralFlags.hasIncrementalUpdates,
      sourceTag: 'PDF Structure / %%EOF count',
      explanation: structuralFlags.hasIncrementalUpdates
        ? 'Multiple %%EOF trailers indicate incremental saves, which can retain prior object states in the byte stream.'
        : 'No multiple incremental-update markers were detected in the trailer structure.',
      rawKey: 'incrementalUpdatesCount',
    },
  ];

  const risk = scorePdfFindings({
    hasAuthor: Boolean(author),
    hasCreatorOrProducer: Boolean(creatorProducer),
    hasTimestamps: Boolean(timestamps),
    hasKeywords: Boolean(keywords),
    hasIncrementalUpdateIndicators: structuralFlags.hasIncrementalUpdates,
  });

  const fieldsFound: Record<string, boolean> = {
    pdf_author: Boolean(author),
    pdf_creator: Boolean(creatorProducer),
    pdf_timestamps: Boolean(timestamps),
    pdf_keywords: Boolean(keywords),
    pdf_incremental: structuralFlags.hasIncrementalUpdates,
  };

  return {
    kind: 'pdf',
    id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    pageCount,
    isSample: Boolean(meta.isSample),
    sampleLabel: meta.sampleLabel,
    findings,
    structuralFlags,
    rawMetadata: {
      Title: title ?? 'NOT PRESENT',
      Author: author ?? 'NOT PRESENT',
      Subject: subject ?? 'NOT PRESENT',
      Keywords: keywords ?? 'NOT PRESENT',
      Creator: creator ?? 'NOT PRESENT',
      Producer: producer ?? 'NOT PRESENT',
      CreationDate: creationDate ?? 'NOT PRESENT',
      ModDate: modificationDate ?? 'NOT PRESENT',
      PageCount: pageCount,
      StructuralMarkers: structuralFlags,
    },
    fieldsFound,
    risk,
    revisionNotice:
      'Full revision history is not available from this analysis. Differing creation and modification timestamps alone do not prove or reconstruct prior document edits.',
    scannedAt: new Date().toISOString(),
  };
}

export async function analyzePdfFile(
  file: File,
  options?: { isSample?: boolean; sampleLabel?: string }
): Promise<PdfScanReport> {
  const buffer = await file.arrayBuffer();
  return analyzePdfBytes(new Uint8Array(buffer), {
    fileName: file.name,
    fileSize: file.size,
    isSample: options?.isSample,
    sampleLabel: options?.sampleLabel,
  });
}
