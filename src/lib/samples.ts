import { PDFDocument } from 'pdf-lib';

export interface SyntheticExifOptions {
  make?: string;
  model?: string;
  software?: string;
  artist?: string;
  copyright?: string;
  dateTimeOriginal?: string;
  bodySerialNumber?: string;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

function writeU16BE(buf: number[], val: number) {
  buf.push((val >> 8) & 0xff, val & 0xff);
}

function writeU32BE(buf: number[], val: number) {
  buf.push((val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff);
}

function asciiBytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    out.push(str.charCodeAt(i) & 0x7f);
  }
  out.push(0); // null terminator
  return out;
}

function decimalToDmsRational(deg: number): [number, number, number, number, number, number] {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const secFloat = (minFloat - m) * 60;
  const secNum = Math.round(secFloat * 100);
  return [d, 1, m, 1, secNum, 100];
}

interface TiffEntry {
  tag: number;
  type: number; // 2 = ASCII, 4 = LONG, 5 = RATIONAL
  count: number;
  inlineOrData: number[]; // raw bytes for value (4 bytes inline if <= 4 bytes, else placed in data area)
}

function buildIfdSection(
  entries: TiffEntry[],
  startOffset: number
): { ifdBytes: number[]; dataBytes: number[]; totalLength: number } {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const ifdSize = 2 + sorted.length * 12 + 4;
  const ifdBytes: number[] = [];
  const dataBytes: number[] = [];

  writeU16BE(ifdBytes, sorted.length);
  let dataCursor = startOffset + ifdSize;

  for (const entry of sorted) {
    writeU16BE(ifdBytes, entry.tag);
    writeU16BE(ifdBytes, entry.type);
    writeU32BE(ifdBytes, entry.count);

    if (entry.inlineOrData.length <= 4) {
      for (let i = 0; i < 4; i++) {
        ifdBytes.push(entry.inlineOrData[i] ?? 0);
      }
    } else {
      writeU32BE(ifdBytes, dataCursor);
      for (const b of entry.inlineOrData) {
        dataBytes.push(b);
      }
      // Pad to even byte boundary
      if (entry.inlineOrData.length % 2 !== 0) {
        dataBytes.push(0);
      }
      dataCursor += entry.inlineOrData.length + (entry.inlineOrData.length % 2);
    }
  }

  // Next IFD offset = 0
  writeU32BE(ifdBytes, 0);
  return {
    ifdBytes,
    dataBytes,
    totalLength: ifdBytes.length + dataBytes.length,
  };
}

/**
 * Injects a standards-compliant EXIF APP1 (TIFF big-endian) segment directly after JPEG SOI (FF D8).
 * Works cleanly in both browser and Node.js without external native binaries.
 */
export function injectExifIntoJpeg(
  jpegBytes: Uint8Array,
  opts: SyntheticExifOptions
): Uint8Array {
  if (jpegBytes.length < 2 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new Error('Input is not a valid JPEG starting with SOI (0xFFD8).');
  }

  // Build ExifIFD entries first to calculate sizes
  const exifEntries: TiffEntry[] = [];
  if (opts.dateTimeOriginal) {
    const bytes = asciiBytes(opts.dateTimeOriginal);
    exifEntries.push({ tag: 0x9003, type: 2, count: bytes.length, inlineOrData: bytes });
  }
  if (opts.bodySerialNumber) {
    const bytes = asciiBytes(opts.bodySerialNumber);
    exifEntries.push({ tag: 0xa431, type: 2, count: bytes.length, inlineOrData: bytes });
  }

  // Build GPS entries
  const gpsEntries: TiffEntry[] = [];
  if (opts.gps) {
    const latRef = opts.gps.latitude >= 0 ? 'N' : 'S';
    const lonRef = opts.gps.longitude >= 0 ? 'E' : 'W';
    const latDms = decimalToDmsRational(opts.gps.latitude);
    const lonDms = decimalToDmsRational(opts.gps.longitude);

    const latBytes: number[] = [];
    for (const v of latDms) writeU32BE(latBytes, v);
    const lonBytes: number[] = [];
    for (const v of lonDms) writeU32BE(lonBytes, v);

    gpsEntries.push({
      tag: 0x0001,
      type: 2,
      count: 2,
      inlineOrData: [latRef.charCodeAt(0), 0, 0, 0],
    });
    gpsEntries.push({
      tag: 0x0002,
      type: 5,
      count: 3,
      inlineOrData: latBytes,
    });
    gpsEntries.push({
      tag: 0x0003,
      type: 2,
      count: 2,
      inlineOrData: [lonRef.charCodeAt(0), 0, 0, 0],
    });
    gpsEntries.push({
      tag: 0x0004,
      type: 5,
      count: 3,
      inlineOrData: lonBytes,
    });
  }

  // Construct IFD0 entries (with placeholder pointer offsets, patched in pass 2)
  const makeIfd0Entries = (exifOffset: number, gpsOffset: number): TiffEntry[] => {
    const list: TiffEntry[] = [];
    if (opts.make) {
      const b = asciiBytes(opts.make);
      list.push({ tag: 0x010f, type: 2, count: b.length, inlineOrData: b });
    }
    if (opts.model) {
      const b = asciiBytes(opts.model);
      list.push({ tag: 0x0110, type: 2, count: b.length, inlineOrData: b });
    }
    if (opts.software) {
      const b = asciiBytes(opts.software);
      list.push({ tag: 0x0131, type: 2, count: b.length, inlineOrData: b });
    }
    if (opts.artist) {
      const b = asciiBytes(opts.artist);
      list.push({ tag: 0x013b, type: 2, count: b.length, inlineOrData: b });
    }
    if (opts.copyright) {
      const b = asciiBytes(opts.copyright);
      list.push({ tag: 0x8298, type: 2, count: b.length, inlineOrData: b });
    }
    if (exifEntries.length > 0) {
      const ptrBytes: number[] = [];
      writeU32BE(ptrBytes, exifOffset);
      list.push({ tag: 0x8769, type: 4, count: 1, inlineOrData: ptrBytes });
    }
    if (gpsEntries.length > 0) {
      const ptrBytes: number[] = [];
      writeU32BE(ptrBytes, gpsOffset);
      list.push({ tag: 0x8825, type: 4, count: 1, inlineOrData: ptrBytes });
    }
    return list;
  };

  // Pass 1: measure IFD0 length
  const tiffHeaderLen = 8;
  const ifd0Pass1 = buildIfdSection(makeIfd0Entries(0, 0), tiffHeaderLen);
  const exifOffset = tiffHeaderLen + ifd0Pass1.totalLength;
  const exifBuilt =
    exifEntries.length > 0
      ? buildIfdSection(exifEntries, exifOffset)
      : { ifdBytes: [], dataBytes: [], totalLength: 0 };
  const gpsOffset = exifOffset + exifBuilt.totalLength;
  const gpsBuilt =
    gpsEntries.length > 0
      ? buildIfdSection(gpsEntries, gpsOffset)
      : { ifdBytes: [], dataBytes: [], totalLength: 0 };

  // Pass 2: finalize IFD0 with exact ExifIFD & GPSIFD offsets
  const ifd0Final = buildIfdSection(makeIfd0Entries(exifOffset, gpsOffset), tiffHeaderLen);

  // Build TIFF block
  const tiffBytes: number[] = [
    0x4d, 0x4d, // MM big-endian
    0x00, 0x2a, // TIFF magic 42
    0x00, 0x00, 0x00, 0x08, // IFD0 offset = 8
    ...ifd0Final.ifdBytes,
    ...ifd0Final.dataBytes,
    ...exifBuilt.ifdBytes,
    ...exifBuilt.dataBytes,
    ...gpsBuilt.ifdBytes,
    ...gpsBuilt.dataBytes,
  ];

  // Build APP1 segment: FF E1 <len> "Exif\0\0" + tiffBytes
  const app1Payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiffBytes];
  const app1Length = app1Payload.length + 2;
  const app1Header: number[] = [0xff, 0xe1];
  writeU16BE(app1Header, app1Length);

  const output = new Uint8Array(2 + app1Header.length + app1Payload.length + (jpegBytes.length - 2));
  output.set(jpegBytes.subarray(0, 2), 0); // FF D8
  output.set(app1Header, 2);
  output.set(app1Payload, 2 + app1Header.length);
  output.set(jpegBytes.subarray(2), 2 + app1Header.length + app1Payload.length);
  return output;
}

/**
 * Minimal valid 1x1 JPEG bytes for headless/Node tests when Canvas is not present.
 */
export const MINIMAL_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04,
  0x03, 0x03, 0x04, 0x05, 0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0a, 0x07,
  0x07, 0x06, 0x08, 0x0c, 0x0a, 0x0c, 0x0c, 0x0b, 0x0a, 0x0b, 0x0b, 0x0d,
  0x0e, 0x12, 0x10, 0x0d, 0x0e, 0x11, 0x0e, 0x0b, 0x0b, 0x10, 0x16, 0x10,
  0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0c, 0x0f, 0x17, 0x18, 0x16, 0x14,
  0x18, 0x12, 0x14, 0x15, 0x14, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0xd2, 0xcf, 0x20, 0xff, 0xd9,
]);

async function renderSamplePhotoBaseJpeg(label: string, accent: string): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return MINIMAL_JPEG_BYTES;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return MINIMAL_JPEG_BYTES;

  const grad = ctx.createLinearGradient(0, 0, 720, 480);
  grad.addColorStop(0, '#04140d');
  grad.addColorStop(0.55, '#0b2b1a');
  grad.addColorStop(1, '#102117');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 480);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(199, 255, 0, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 40; x < 720; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 480);
    ctx.stroke();
  }
  for (let y = 40; y < 480; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(720, y);
    ctx.stroke();
  }

  // Stylized urban skyline silhouette + street lights
  ctx.fillStyle = '#030b07';
  ctx.fillRect(0, 320, 720, 160);
  ctx.fillRect(70, 210, 95, 110);
  ctx.fillRect(190, 165, 120, 155);
  ctx.fillRect(340, 230, 85, 90);
  ctx.fillRect(460, 145, 130, 175);

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(540, 110, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D7FFE0';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(label, 36, 56);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#7FB98A';
  ctx.fillText('SYNTHETIC FORENSIC TEST ASSET · REAL EXIF BINARY', 36, 82);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create sample JPEG'))),
      'image/jpeg',
      0.92
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createSampleGpsPhoto(): Promise<File> {
  const baseJpeg = await renderSamplePhotoBaseJpeg(
    'SAMPLE: CAMPUS CAPTURE',
    'rgba(255, 176, 0, 0.35)'
  );
  const withExif = injectExifIntoJpeg(baseJpeg, {
    make: 'Apple',
    model: 'iPhone 15 Pro',
    software: 'iOS 18.1.1',
    artist: 'Sample Creator (Synthetic)',
    copyright: 'SAMPLE TEST ASSET',
    dateTimeOriginal: '2026:10:14 18:42:19',
    bodySerialNumber: 'SYN-CAM-004918',
    gps: {
      latitude: 37.774929,
      longitude: -122.419416,
    },
  });
  return new File([new Uint8Array(withExif)], 'SAMPLE_phone_photo_gps.jpg', {
    type: 'image/jpeg',
  });
}

export async function createSampleDevicePhoto(): Promise<File> {
  const baseJpeg = await renderSamplePhotoBaseJpeg(
    'SAMPLE: STUDIO WORKFLOW',
    'rgba(0, 255, 65, 0.25)'
  );
  const withExif = injectExifIntoJpeg(baseJpeg, {
    make: 'SONY',
    model: 'ILCE-7M4',
    software: 'Adobe Lightroom Classic 14.0 (Synthetic)',
    artist: 'Studio Test Archive (Synthetic)',
    copyright: 'SAMPLE TEST ASSET',
    dateTimeOriginal: '2026:09:02 14:15:07',
  });
  return new File([new Uint8Array(withExif)], 'SAMPLE_device_author_photo.jpg', {
    type: 'image/jpeg',
  });
}

export async function createSampleResumePdf(): Promise<File> {
  const doc = await PDFDocument.create();
  const page1 = doc.addPage([595, 842]);
  page1.drawText('SAMPLE DOCUMENT — SYNTHETIC FORENSIC TEST FILE', {
    x: 50,
    y: 780,
    size: 14,
  });
  page1.drawText('Candidate Resume Summary (Synthetic Sample · Page 1 of 2)', {
    x: 50,
    y: 745,
    size: 11,
  });
  page1.drawText('This PDF contains embedded Info dictionary fields for local inspection.', {
    x: 50,
    y: 718,
    size: 10,
  });
  page1.drawText('Role Focus: Security Engineering · Availability: Immediate (Synthetic)', {
    x: 50,
    y: 685,
    size: 10,
  });

  const page2 = doc.addPage([595, 842]);
  page2.drawText('SAMPLE DOCUMENT — PAGE 2 (SYNTHETIC APPENDIX)', {
    x: 50,
    y: 780,
    size: 13,
  });
  page2.drawText('Projects & Publications (Fictional Sample Data)', {
    x: 50,
    y: 745,
    size: 11,
  });
  page2.drawText('1. Client-side EXIF & XMP sanitization workbench demo.', {
    x: 50,
    y: 715,
    size: 10,
  });

  doc.setTitle('SAMPLE_Resume_Draft_2026_Internal');
  doc.setAuthor('Jordan Taylor (Synthetic Sample)');
  doc.setSubject('Employment Application Draft');
  doc.setKeywords(['resume', 'internal-draft', 'synthetic-sample']);
  doc.setCreator('Microsoft Word for Mac (Synthetic)');
  doc.setProducer('macOS Quartz PDFContext (Synthetic)');
  doc.setCreationDate(new Date('2026-10-01T09:14:00Z'));
  doc.setModificationDate(new Date('2026-10-12T16:48:00Z'));

  const bytes = await doc.save({ useObjectStreams: false });
  return new File([new Uint8Array(bytes)], 'SAMPLE_resume_metadata.pdf', {
    type: 'application/pdf',
  });
}

export const SAMPLE_TEXT_POST = `Every day we post short updates without noticing the “invisible” formatting habits baked into them.\u00A0When text is copied from a desktop editor, typographic quotes, non-breaking spaces, and recurring sentence structures travel right alongside the message.

In public channels, these patterns can still be measured—even after attachments are removed. However, statistical patterns alone do not prove who wrote a message, nor do they serve as a reliable authorship verdict!`;
