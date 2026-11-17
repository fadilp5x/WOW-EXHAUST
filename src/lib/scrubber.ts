import { PDFDocument, PDFName } from 'pdf-lib';
import type {
  ImageScanReport,
  PdfScanReport,
  ProofOfScrub,
} from '../types/forensics';
import { analyzeImageFile } from './imageForensics';
import { analyzePdfBytes } from './pdfForensics';

export interface ImageScrubOptions {
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
  applyExperimentalNoise?: boolean;
}

export interface ImageTransparencyCheck {
  hasTransparency: boolean;
  width: number;
  height: number;
}

export async function inspectImageTransparency(
  file: File
): Promise<ImageTransparencyCheck> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (file.type === 'image/jpeg') {
    bitmap.close();
    return { hasTransparency: false, width, height };
  }

  const canvas = document.createElement('canvas');
  // Sample at capped dimensions for fast alpha detection
  const sampleW = Math.min(width, 256);
  const sampleH = Math.min(height, 256);
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return { hasTransparency: false, width, height };
  }
  ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
  bitmap.close();

  const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
  let hasTransparency = false;
  for (let i = 3; i < imgData.length; i += 4) {
    if (imgData[i] < 250) {
      hasTransparency = true;
      break;
    }
  }
  return { hasTransparency, width, height };
}

export async function scrubImageAndVerify(
  originalFile: File,
  originalReport: ImageScanReport,
  options: ImageScrubOptions = {
    outputFormat: 'image/jpeg',
    quality: 0.92,
    applyExperimentalNoise: false,
  }
): Promise<{
  cleanedFile: File;
  afterReport: ImageScanReport;
  proof: ProofOfScrub;
}> {
  const bitmap = await createImageBitmap(originalFile);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('2D canvas context unavailable for local image re-encoding.');
  }

  if (options.outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  if (options.applyExperimentalNoise) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    // Minimal deterministic +/-1 LSB perturbation on sparse pixels (explicitly non-protective experiment)
    for (let i = 0; i < data.length; i += 16) {
      const delta = (i % 32 === 0 ? 1 : -1);
      data[i] = Math.min(255, Math.max(0, data[i] + delta));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const quality = options.quality ?? 0.92;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error('Failed to encode scrubbed image blob.'));
        else resolve(result);
      },
      options.outputFormat,
      options.outputFormat === 'image/png' ? undefined : quality
    );
  });

  const ext =
    options.outputFormat === 'image/png'
      ? 'png'
      : options.outputFormat === 'image/webp'
        ? 'webp'
        : 'jpg';
  const baseName = originalFile.name.replace(/\.[^.]+$/, '');
  const cleanedName = `${baseName}_scrubbed.${ext}`;
  const cleanedFile = new File([blob], cleanedName, {
    type: options.outputFormat,
  });

  // Re-run real extractor on cleaned bytes
  const afterReport = await analyzeImageFile(cleanedFile);

  const removedFields = originalReport.findings
    .filter((f) => f.present)
    .filter((f) => {
      const afterMatch = afterReport.findings.find((af) => af.id === f.id);
      return !afterMatch || !afterMatch.present;
    })
    .map((f) => `${f.label} (${f.sourceTag})`);

  const remainingFields = afterReport.findings
    .filter((f) => f.present)
    .map((f) => `${f.label}: ${f.value}`);

  const cleanedBlobUrl = URL.createObjectURL(cleanedFile);

  const knownLimitations: string[] = [
    'Metadata scrubbing strips container tags (EXIF, XMP, IPTC, GPS) by decoding and re-encoding pixels locally.',
    'Visual landmarks, reflections, or text visible inside the photograph pixels remain visible.',
  ];
  if (options.outputFormat === 'image/jpeg') {
    knownLimitations.push(
      'JPEG re-encoding (quality 0.92) applies lossy compression, flattens alpha transparency onto white, and normalizes embedded ICC color profiles.'
    );
  }
  if (options.applyExperimentalNoise) {
    knownLimitations.push(
      'Experimental pixel modification alters sparse pixel LSBs only; it is NOT an anti-recognition or tracking guarantee.'
    );
  }

  const proof: ProofOfScrub = {
    originalScore: originalReport.risk.score,
    cleanedScore: afterReport.risk.score,
    originalBand: originalReport.risk.band,
    cleanedBand: afterReport.risk.band,
    originalMetadataCount: originalReport.findings.filter((f) => f.present).length,
    remainingMetadataCount: afterReport.findings.filter((f) => f.present).length,
    removedFields,
    remainingFields,
    verifiedAt: new Date().toISOString(),
    processingMethod: `Local Canvas Re-encode (${options.outputFormat}${options.outputFormat !== 'image/png' ? ` @ q=${quality}` : ''}) + exifr Re-verification`,
    knownLimitations,
    cleanedFileName: cleanedName,
    cleanedFileSize: cleanedFile.size,
    cleanedMimeType: options.outputFormat,
    cleanedBlobUrl,
  };

  return { cleanedFile, afterReport, proof };
}

export async function scrubPdfAndVerify(
  originalBytes: Uint8Array,
  originalReport: PdfScanReport
): Promise<{
  cleanedBytes: Uint8Array;
  afterReport: PdfScanReport;
  proof: ProofOfScrub;
}> {
  const srcDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const cleanDoc = await PDFDocument.create({ updateMetadata: false });
  const pageIndices = srcDoc.getPageIndices();
  const copiedPages = await cleanDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    cleanDoc.addPage(page);
  }

  // Clear Info dictionary entries explicitly so pdf-lib does not retain Author/Creator/Producer/Timestamps
  const infoDict = (cleanDoc as unknown as { getInfoDict?: () => { delete: (key: PDFName) => void } }).getInfoDict?.();
  if (infoDict) {
    const keysToDelete = [
      'Title',
      'Author',
      'Subject',
      'Keywords',
      'Creator',
      'Producer',
      'CreationDate',
      'ModDate',
    ];
    for (const k of keysToDelete) {
      infoDict.delete(PDFName.of(k));
    }
  }

  const cleanedBytes = await cleanDoc.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
  });

  const baseName = originalReport.fileName.replace(/\.pdf$/i, '');
  const cleanedName = `${baseName}_metadata_reduced.pdf`;

  // Re-run real PDF extractor on cleaned bytes
  const afterReport = await analyzePdfBytes(cleanedBytes, {
    fileName: cleanedName,
    fileSize: cleanedBytes.byteLength,
  });

  const removedFields = originalReport.findings
    .filter((f) => f.present)
    .filter((f) => {
      const afterMatch = afterReport.findings.find((af) => af.id === f.id);
      return !afterMatch || !afterMatch.present;
    })
    .map((f) => `${f.label} (${f.sourceTag})`);

  const remainingFields = afterReport.findings
    .filter((f) => f.present)
    .map((f) => `${f.label}: ${f.value}`);

  const knownLimitations: string[] = [
    'Copying pages into a fresh PDF container reduces Info dictionary metadata and flattens incremental %%EOF history, but is NOT proof that all hidden content has been removed.',
  ];
  if (originalReport.structuralFlags.hasEmbeddedFiles) {
    knownLimitations.push('Original PDF contained /EmbeddedFiles markers — verify attachments manually.');
  }
  if (originalReport.structuralFlags.hasAnnotations) {
    knownLimitations.push('Original PDF contained /Annots (comments or markup) — review page annotations.');
  }
  if (originalReport.structuralFlags.hasFormFields) {
    knownLimitations.push('Original PDF contained /AcroForm interactive form fields.');
  }
  if (originalReport.structuralFlags.hasDigitalSignatures) {
    knownLimitations.push('Original PDF contained digital signature markers (/Sig) which are invalidated by rewriting.');
  }
  knownLimitations.push(
    'Embedded XMP streams inside page resources, rasterized text, or hidden layers require specialized offline PDF/A flattening.'
  );

  let cleanedBlobUrl: string | undefined;
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([new Uint8Array(cleanedBytes)], { type: 'application/pdf' });
    cleanedBlobUrl = URL.createObjectURL(blob);
  }

  const proof: ProofOfScrub = {
    originalScore: originalReport.risk.score,
    cleanedScore: afterReport.risk.score,
    originalBand: originalReport.risk.band,
    cleanedBand: afterReport.risk.band,
    originalMetadataCount: originalReport.findings.filter((f) => f.present).length,
    remainingMetadataCount: afterReport.findings.filter((f) => f.present).length,
    removedFields,
    remainingFields,
    verifiedAt: new Date().toISOString(),
    processingMethod: 'Local pdf-lib Container Rebuild (Metadata-Reduced) + Re-verification',
    knownLimitations,
    cleanedFileName: cleanedName,
    cleanedFileSize: cleanedBytes.byteLength,
    cleanedMimeType: 'application/pdf',
    cleanedBlobUrl,
  };

  return { cleanedBytes, afterReport, proof };
}
