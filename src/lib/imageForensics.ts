import exifr from 'exifr';
import type {
  ForensicFinding,
  GpsCoordinates,
  ImageScanReport,
} from '../types/forensics';
import { scoreImageFindings } from './scoring';

function formatExifValue(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  }
  const str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null') return null;
  return str;
}

function sanitizeRawObject(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      cleaned[key] = `[Binary ${value instanceof Uint8Array ? value.byteLength : value.byteLength} bytes]`;
    } else if (value instanceof Date) {
      cleaned[key] = value.toISOString();
    } else if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
        cleaned[key] = value;
      } catch {
        cleaned[key] = String(value);
      }
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function analyzeImageBytes(
  bytes: Uint8Array | ArrayBuffer,
  meta: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    isSample?: boolean;
    sampleLabel?: string;
    previewUrl?: string;
    width?: number;
    height?: number;
  }
): Promise<ImageScanReport> {
  let parsed: Record<string, unknown> = {};
  let gpsResult: { latitude?: number; longitude?: number; altitude?: number } | null = null;

  try {
    const rawParsed = await exifr.parse(bytes, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      jfif: true,
      ihdr: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    });
    if (rawParsed && typeof rawParsed === 'object') {
      parsed = rawParsed as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  try {
    const gps = await exifr.gps(bytes);
    if (
      gps &&
      typeof gps.latitude === 'number' &&
      typeof gps.longitude === 'number' &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    ) {
      gpsResult = {
        latitude: Number(gps.latitude.toFixed(6)),
        longitude: Number(gps.longitude.toFixed(6)),
        altitude:
          typeof (parsed.GPSAltitude as number | undefined) === 'number'
            ? Number((parsed.GPSAltitude as number).toFixed(1))
            : undefined,
      };
    }
  } catch {
    gpsResult = null;
  }

  // Fallback check if GPSLatitude/Longitude exist in parsed directly
  if (
    !gpsResult &&
    typeof parsed.latitude === 'number' &&
    typeof parsed.longitude === 'number' &&
    Number.isFinite(parsed.latitude) &&
    Number.isFinite(parsed.longitude)
  ) {
    gpsResult = {
      latitude: Number(parsed.latitude.toFixed(6)),
      longitude: Number(parsed.longitude.toFixed(6)),
    };
  }

  const gps: GpsCoordinates | null = gpsResult
    ? {
        latitude: gpsResult.latitude!,
        longitude: gpsResult.longitude!,
        altitude: gpsResult.altitude,
      }
    : null;

  const make = formatExifValue(parsed.Make);
  const model = formatExifValue(parsed.Model);
  const deviceCombined = [make, model].filter(Boolean).join(' ') || null;

  const lensModel = formatExifValue(parsed.LensModel ?? parsed.Lens);
  const serial = formatExifValue(
    parsed.BodySerialNumber ??
      parsed.SerialNumber ??
      parsed.InternalSerialNumber ??
      parsed.LensSerialNumber
  );

  const captureTime = formatExifValue(
    parsed.DateTimeOriginal ?? parsed.CreateDate ?? parsed.DateTimeDigitized ?? parsed.ModifyDate
  );

  const software = formatExifValue(parsed.Software ?? parsed.CreatorTool);
  const artist = formatExifValue(parsed.Artist ?? parsed.Creator ?? parsed.Byline);
  const copyright = formatExifValue(parsed.Copyright ?? parsed.Rights);
  const ownerCombined = [artist, copyright].filter(Boolean).join(' · ') || null;

  const cameraSettingsParts = [
    parsed.FocalLength ? `${parsed.FocalLength}mm` : null,
    parsed.FNumber ? `f/${parsed.FNumber}` : null,
    typeof parsed.ExposureTime === 'number' && parsed.ExposureTime > 0
      ? parsed.ExposureTime < 1
        ? `1/${Math.round(1 / parsed.ExposureTime)}s`
        : `${parsed.ExposureTime}s`
      : null,
    parsed.ISO ? `ISO ${parsed.ISO}` : null,
  ].filter(Boolean);
  const cameraSettings = cameraSettingsParts.length > 0 ? cameraSettingsParts.join(' · ') : null;
  const orientation = formatExifValue(parsed.Orientation);

  const findings: ForensicFinding[] = [
    {
      id: 'where_gps',
      category: 'WHERE',
      label: 'GPS Coordinates',
      value: gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'NOT PRESENT',
      present: Boolean(gps),
      sourceTag: 'EXIF / GPSLatitude & GPSLongitude',
      explanation: gps
        ? 'This image contains coordinates recorded during capture. Anyone who receives the original file may be able to inspect them.'
        : 'No geographic coordinates were found in EXIF GPS tags.',
      rawKey: 'latitude',
    },
    {
      id: 'when_capture',
      category: 'WHEN',
      label: 'Capture Timestamp',
      value: captureTime ?? 'NOT PRESENT',
      present: Boolean(captureTime),
      sourceTag: parsed.DateTimeOriginal ? 'EXIF / DateTimeOriginal' : 'EXIF / CreateDate',
      explanation: captureTime
        ? 'Embedded capture time records when the shutter fired according to the device clock.'
        : 'No capture date or timestamp was found.',
      rawKey: 'DateTimeOriginal',
    },
    {
      id: 'device_model',
      category: 'DEVICE',
      label: 'Device Make & Model',
      value: deviceCombined ?? 'NOT PRESENT',
      present: Boolean(deviceCombined),
      sourceTag: 'EXIF / Make & Model',
      explanation: deviceCombined
        ? 'Hardware manufacturer and model identifiers narrow down the camera or phone used.'
        : 'No device manufacturer or model string was found.',
      rawKey: 'Model',
    },
    {
      id: 'device_serial',
      category: 'DEVICE',
      label: 'Camera / Lens Serial',
      value: serial ?? 'NOT PRESENT',
      present: Boolean(serial),
      sourceTag: 'EXIF / BodySerialNumber',
      explanation: serial
        ? 'Hardware serial identifiers can uniquely link multiple photographs to the same physical device.'
        : 'No hardware serial number tag was found.',
      rawKey: 'BodySerialNumber',
    },
    {
      id: 'device_settings',
      category: 'DEVICE',
      label: 'Lens & Exposure Settings',
      value: [lensModel, cameraSettings, orientation ? `Orientation: ${orientation}` : null]
        .filter(Boolean)
        .join(' · ') || 'NOT PRESENT',
      present: Boolean(lensModel || cameraSettings || orientation),
      sourceTag: 'EXIF / LensModel, FNumber, ISO, Orientation',
      explanation:
        lensModel || cameraSettings || orientation
          ? 'Optical and sensor configuration parameters are embedded in the file.'
          : 'No lens, exposure, or orientation metadata was found.',
      rawKey: 'LensModel',
    },
    {
      id: 'owner_signals',
      category: 'OWNER SIGNALS',
      label: 'Artist / Copyright',
      value: ownerCombined ?? 'NOT PRESENT',
      present: Boolean(ownerCombined),
      sourceTag: artist ? 'EXIF / Artist' : 'EXIF / Copyright',
      explanation: ownerCombined
        ? 'Explicit creator, artist, or copyright strings may identify the person or organization.'
        : 'No artist, creator, or copyright metadata was found.',
      rawKey: artist ? 'Artist' : 'Copyright',
    },
    {
      id: 'software_trace',
      category: 'SOFTWARE',
      label: 'Processing Software',
      value: software ?? 'NOT PRESENT',
      present: Boolean(software),
      sourceTag: 'EXIF / Software',
      explanation: software
        ? 'Indicates operating system firmware or editing software used to write or export the image.'
        : 'No software or editing tool trace was found.',
      rawKey: 'Software',
    },
  ];

  const risk = scoreImageFindings({
    hasGps: Boolean(gps),
    hasCameraSerial: Boolean(serial),
    hasExactTimestamp: Boolean(captureTime),
    hasDeviceMakeModel: Boolean(deviceCombined),
    hasOwnerOrCopyright: Boolean(ownerCombined),
    hasSoftwareTrace: Boolean(software),
  });

  const fieldsFound: Record<string, boolean> = {
    gps: Boolean(gps),
    serial: Boolean(serial),
    timestamp: Boolean(captureTime),
    device: Boolean(deviceCombined),
    owner: Boolean(ownerCombined),
    software: Boolean(software),
  };

  const anyMetadataFound = Object.values(fieldsFound).some(Boolean);

  const exifWidth =
    typeof parsed.ExifImageWidth === 'number'
      ? parsed.ExifImageWidth
      : typeof parsed.ImageWidth === 'number'
        ? parsed.ImageWidth
        : undefined;
  const exifHeight =
    typeof parsed.ExifImageHeight === 'number'
      ? parsed.ExifImageHeight
      : typeof parsed.ImageHeight === 'number'
        ? parsed.ImageHeight
        : undefined;

  return {
    kind: 'image',
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    mimeType: meta.mimeType,
    width: meta.width ?? exifWidth,
    height: meta.height ?? exifHeight,
    isSample: Boolean(meta.isSample),
    sampleLabel: meta.sampleLabel,
    previewUrl: meta.previewUrl,
    gps,
    findings,
    rawMetadata: sanitizeRawObject(parsed),
    fieldsFound,
    risk,
    hasNoExifMessage: !anyMetadataFound,
    scannedAt: new Date().toISOString(),
  };
}

export async function analyzeImageFile(
  file: File,
  options?: { isSample?: boolean; sampleLabel?: string }
): Promise<ImageScanReport> {
  const buffer = await file.arrayBuffer();
  const previewUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : undefined;

  let width: number | undefined;
  let height: number | undefined;
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      // ignore if unsupported format in headless env
    }
  }

  return analyzeImageBytes(buffer, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'image/jpeg',
    width,
    height,
    isSample: options?.isSample,
    sampleLabel: options?.sampleLabel,
    previewUrl,
  });
}
