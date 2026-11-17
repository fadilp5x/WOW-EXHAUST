import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Crop,
  Download,
  Eraser,
  Eye,
  ShieldAlert,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ImageScanReport,
  VisualInspectionResponse,
  VisualObservation,
} from '../../types/forensics';

interface VisualInspectionPanelProps {
  report: ImageScanReport;
  sourceFile: File | null;
  inspectionResult: VisualInspectionResponse | null;
  highlightedObsId: string | null;
  onInspectionResult: (res: VisualInspectionResponse) => void;
  onHighlightObservation: (obs: VisualObservation | null) => void;
}

interface BlurRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function fileToResizedBase64(file: File): Promise<{
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable for image preparation.');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const outMime: 'image/jpeg' | 'image/png' | 'image/webp' =
    file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outMime, 0.86);
  const base64 = dataUrl.split(',')[1] ?? '';
  return { base64, mimeType: outMime };
}

export function VisualInspectionPanel({
  report,
  sourceFile,
  inspectionResult,
  highlightedObsId,
  onInspectionResult,
  onHighlightObservation,
}: VisualInspectionPanelProps) {
  const [consentOpen, setConsentOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  const [blurRects, setBlurRects] = useState<BlurRect[]>([]);
  const [cropMarginPct, setCropMarginPct] = useState<number>(0);
  const [showOriginalToggle, setShowOriginalToggle] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setBlurRects([]);
    setCropMarginPct(0);
    setShowOriginalToggle(false);
    setConsentOpen(false);
  }, [report.id]);

  useEffect(() => {
    let active = true;
    const url = report.previewUrl;
    const canvas = editorCanvasRef.current;
    if (!url || !canvas) return;

    const img = new Image();
    img.onload = () => {
      if (!active) return;
      const cropPxX = Math.round((img.width * cropMarginPct) / 100);
      const cropPxY = Math.round((img.height * cropMarginPct) / 100);
      const sx = showOriginalToggle ? 0 : cropPxX;
      const sy = showOriginalToggle ? 0 : cropPxY;
      const sw = showOriginalToggle ? img.width : Math.max(40, img.width - cropPxX * 2);
      const sh = showOriginalToggle ? img.height : Math.max(40, img.height - cropPxY * 2);

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      if (!showOriginalToggle) {
        for (const r of blurRects) {
          const rx = Math.round(r.x * sw);
          const ry = Math.round(r.y * sh);
          const rw = Math.max(8, Math.round(r.w * sw));
          const rh = Math.max(8, Math.round(r.h * sh));

          const block = Math.max(10, Math.round(Math.min(rw, rh) / 6));
          for (let py = ry; py < ry + rh && py < sh; py += block) {
            for (let px = rx; px < rx + rw && px < sw; px += block) {
              const sample = ctx.getImageData(
                Math.min(sw - 1, Math.max(0, px)),
                Math.min(sh - 1, Math.max(0, py)),
                1,
                1
              ).data;
              ctx.fillStyle = `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})`;
              ctx.fillRect(px, py, block, block);
            }
          }
          ctx.strokeStyle = '#CDF22B';
          ctx.lineWidth = 2;
          ctx.strokeRect(rx, ry, rw, rh);
        }
      }
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [blurRects, cropMarginPct, report.previewUrl, showOriginalToggle]);

  const handleConfirmVisualInspection = async () => {
    if (!sourceFile) return;
    setConsentOpen(false);
    setIsInspecting(true);
    try {
      const { base64, mimeType } = await fileToResizedBase64(sourceFile);
      const res = await fetch('/api/visual-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGranted: true,
          mimeType,
          imageBase64: base64,
        }),
      });
      const data = (await res.json()) as VisualInspectionResponse;
      onInspectionResult(data);
      if (data.available) {
        toast.success(data.summaryNote);
      } else {
        toast.info('AI visual inspection is currently unavailable. Local file analysis remains available.');
      }
    } catch {
      onInspectionResult({
        available: false,
        provider: 'unavailable',
        observations: [],
        summaryNote:
          'AI visual inspection is currently unavailable. Local file analysis remains available.',
        disclosure: '',
      });
      toast.info('AI visual inspection is currently unavailable. Local file analysis remains available.');
    } finally {
      setIsInspecting(false);
    }
  };

  const getRelativeCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleExportEditedImage = () => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = report.fileName.replace(/\.[^.]+$/, '');
        a.download = `${baseName}_redacted_clean.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported edited & metadata-free PNG copy.');
      },
      'image/png'
    );
  };

  return (
    <section
      aria-label="AI VISUAL PRIVACY INSPECTION"
      className="card-unseen p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#08090B]/8 pb-3">
        <div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#F0FDFA] border border-[#00545F]/30 text-[#00545F] font-semibold">
            AI VISUAL OBSERVATION (SEPARATE FROM VERIFIED EXIF)
          </span>
          <h3 className="font-display text-xl font-bold text-[#08090B] mt-1.5">
            AI Visual Privacy Inspection & Pixel Redaction
          </h3>
          <p className="font-sans text-xs text-[#525866]">
            Optional consented Gemini scan for visible badges, name tags, logos, readable screens, or plates inside pixels. Never identifies faces.
          </p>
        </div>

        <button
          type="button"
          disabled={isInspecting || !sourceFile}
          onClick={() => setConsentOpen(true)}
          className="btn-tactile-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#00545F]" />
          <span>{isInspecting ? 'Inspecting Pixels...' : 'Run AI Visual Inspection'}</span>
        </button>
      </div>

      {consentOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="visual-consent-title"
          className="rounded-2xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-4 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4
                id="visual-consent-title"
                className="font-mono text-xs font-bold text-[#92400E] tracking-wider"
              >
                ALLOW AI VISUAL INSPECTION?
              </h4>
              <p className="font-sans text-xs text-[#08090B]">
                Your image will be sent to the selected AI provider (Google Gemini server endpoint) for visual analysis. Local metadata scanning does not require this.
              </p>
              <p className="font-sans text-[11px] text-[#525866]">
                Note: Hosted AI retention depends on the configured Gemini API tier and is not governed by EXHAUST&apos;s MongoDB 2-hour TTL.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConsentOpen(false)}
              className="btn-tactile-secondary px-3 py-1.5 text-xs cursor-pointer"
            >
              Continue Locally
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmVisualInspection()}
              className="btn-tactile-lime px-3.5 py-1.5 text-xs cursor-pointer"
            >
              Allow AI Inspection
            </button>
          </div>
        </div>
      )}

      {inspectionResult && (
        <div className="space-y-2">
          {!inspectionResult.available ? (
            <div className="rounded-2xl border border-[#F59E0B]/50 bg-[#FFFBEB] p-3 font-mono text-xs text-[#92400E]">
              {inspectionResult.summaryNote}
            </div>
          ) : inspectionResult.observations.length === 0 ? (
            <div className="rounded-2xl border border-[#12A36B]/35 bg-[#F2FBF6] p-3 font-mono text-xs text-[#0F766E]">
              {inspectionResult.summaryNote}
            </div>
          ) : (
            <div className="space-y-2">
              {inspectionResult.observations.map((obs) => {
                const isSelected = highlightedObsId === obs.id;
                return (
                  <div
                    key={obs.id}
                    onClick={() => onHighlightObservation(isSelected ? null : obs)}
                    className={`rounded-2xl border p-3 space-y-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#FF4B4B] bg-[#FFF2F2]'
                        : 'border-[#00545F]/25 bg-[#F0FDFA] hover:border-[#00545F]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#00545F]">
                        AI VISUAL OBSERVATION · {obs.category.toUpperCase()}
                      </span>
                      <span className="font-mono text-[10px] text-[#525866]">
                        {obs.region ? 'Click to Highlight' : 'No Bounding Box'}
                      </span>
                    </div>
                    <p className="font-display text-xs font-bold text-[#08090B]">{obs.title}</p>
                    <p className="font-sans text-xs text-[#525866]">{obs.evidenceDescription}</p>
                    <p className="font-mono text-[11px] text-[#B45309]">
                      Mitigation: {obs.suggestedMitigation}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {report.previewUrl && (
        <div className="rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-mono text-xs text-[#08090B] font-bold flex items-center gap-1.5">
                <Eraser className="w-3.5 h-3.5 text-[#00545F]" />
                LOCAL PIXEL REDACTION & CROP EDITOR
              </h4>
              <p className="font-sans text-[11px] text-[#525866]">
                Drag across the image below to pixelate/blur badges, plates, or screens locally.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setShowOriginalToggle((s) => !s)}
                className="btn-tactile-secondary px-2.5 py-1 text-[10px] inline-flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                {showOriginalToggle ? 'View Edited' : 'Before / Original'}
              </button>
              <button
                type="button"
                disabled={blurRects.length === 0}
                onClick={() => setBlurRects((r) => r.slice(0, -1))}
                className="btn-tactile-secondary px-2.5 py-1 text-[10px] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                Undo Blur
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#525866]">
            <label htmlFor="visual-crop-range" className="inline-flex items-center gap-1.5 font-semibold text-[#08090B]">
              <Crop className="w-3.5 h-3.5 text-[#00545F]" />
              Crop Edges: {cropMarginPct}%
            </label>
            <input
              id="visual-crop-range"
              type="range"
              min={0}
              max={25}
              step={5}
              value={cropMarginPct}
              onChange={(e) => setCropMarginPct(Number(e.target.value))}
              className="accent-[#08090B] cursor-pointer"
            />
          </div>

          <div className="relative rounded-2xl bg-[#08090B] border border-[#08090B]/15 flex justify-center overflow-hidden">
            <canvas
              ref={editorCanvasRef}
              onPointerDown={(e) => {
                const pt = getRelativeCanvasPoint(e);
                if (pt) {
                  setDragStart(pt);
                  setDragCurrent(pt);
                }
              }}
              onPointerMove={(e) => {
                if (!dragStart) return;
                const pt = getRelativeCanvasPoint(e);
                if (pt) setDragCurrent(pt);
              }}
              onPointerUp={() => {
                if (dragStart && dragCurrent) {
                  const x = Math.min(dragStart.x, dragCurrent.x);
                  const y = Math.min(dragStart.y, dragCurrent.y);
                  const w = Math.abs(dragCurrent.x - dragStart.x);
                  const h = Math.abs(dragCurrent.y - dragStart.y);
                  if (w > 0.02 && h > 0.02) {
                    setBlurRects((prev) => [...prev, { x, y, w, h }]);
                  }
                }
                setDragStart(null);
                setDragCurrent(null);
              }}
              className="max-h-60 w-auto touch-none cursor-crosshair"
            />
            {dragStart && dragCurrent && (
              <div
                className="absolute border-2 border-dashed border-[#CDF22B] bg-[#CDF22B]/20 pointer-events-none"
                style={{
                  left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                  top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                  width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                  height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-sans text-[11px] text-[#525866] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              Visual blurring and cropping help obscure visible details, but do not guarantee anonymity.
            </p>
            <button
              type="button"
              onClick={handleExportEditedImage}
              className="btn-tactile-lime px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Edited Copy</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
