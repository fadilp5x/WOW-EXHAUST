import { useState } from 'react';
import {
  FileText,
  HardDrive,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Play,
  Trash2,
  Type,
} from 'lucide-react';
import type {
  AnyScanReport,
  ScanStatus,
  VisualObservation,
} from '../../types/forensics';
import { PdfCanvasPreview } from './PdfCanvasPreview';

interface CurrentInputPanelProps {
  inputType: 'image' | 'pdf' | 'text' | null;
  title: string;
  formatLabel: string;
  sizeBytes?: number;
  dimensions?: { width: number; height: number } | null;
  pageCount?: number;
  source: 'sample' | 'user' | null;
  previewUrl?: string | null;
  pdfBytes?: Uint8Array | null;
  textSnippet?: string;
  scanStatus: ScanStatus;
  report: AnyScanReport | null;
  highlightedVisualObs?: VisualObservation | null;
  onAnalyze: () => void;
  onClear: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CurrentInputPanel({
  inputType,
  title,
  formatLabel,
  sizeBytes,
  dimensions,
  pageCount,
  source,
  previewUrl,
  pdfBytes,
  textSnippet,
  scanStatus,
  report,
  highlightedVisualObs,
  onAnalyze,
  onClear,
}: CurrentInputPanelProps) {
  const [expandedPreview, setExpandedPreview] = useState(false);

  if (!inputType) return null;

  const isBusy = scanStatus === 'processing';

  const typeDisplay =
    inputType === 'image'
      ? 'Photo (Image)'
      : inputType === 'pdf'
        ? 'PDF Document'
        : 'Plain Text';

  const sourceDisplay =
    source === 'sample'
      ? title.toLowerCase().includes('gps')
        ? 'Sample (Phone GPS)'
        : title.toLowerCase().includes('device')
          ? 'Sample (Device EXIF)'
          : inputType === 'pdf'
            ? 'Sample (Resume PDF)'
            : 'Sample (Text Post)'
      : 'Local User Input';

  const specSummary =
    inputType === 'text'
      ? `${textSnippet?.length ?? 0} chars`
      : `${formatLabel}${sizeBytes ? ` · ${formatBytes(sizeBytes)}` : ''}${
          inputType === 'image' && dimensions
            ? ` · ${dimensions.width} × ${dimensions.height}`
            : inputType === 'pdf' && pageCount
              ? ` · ${pageCount} pages`
              : ''
        }`;

  return (
    <section
      aria-label="CURRENT INPUT"
      data-testid="current-input-panel"
      className="card-unseen p-4 space-y-3.5"
    >
      {/* Top File Header matching mockup */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[#FAF8F3] border border-[#08090B]/10 flex items-center justify-center shrink-0">
            {inputType === 'image' ? (
              <ImageIcon className="w-4 h-4 text-[#08090B]" />
            ) : inputType === 'pdf' ? (
              <FileText className="w-4 h-4 text-[#08090B]" />
            ) : (
              <Type className="w-4 h-4 text-[#00545F]" />
            )}
          </div>
          <div className="min-w-0">
            <h2
              className="font-display text-sm font-bold text-[#08090B] truncate"
              title={title}
            >
              {title}
            </h2>
            <p className="font-mono text-[10px] text-[#525866] truncate tabular-nums">
              {specSummary}
            </p>
          </div>
        </div>

        {source && (
          <span
            className={`shrink-0 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
              source === 'sample'
                ? 'bg-[#ECFFB6] text-[#08090B] border border-[#95ba07]/35'
                : 'bg-[#FAF8F3] text-[#08090B] border border-[#08090B]/15'
            }`}
          >
            {source === 'sample' ? 'SAMPLE' : 'USER FILE'}
          </span>
        )}
      </div>

      {/* Live Preview Surface */}
      {inputType === 'image' && previewUrl && (
        <div
          className={`relative rounded-2xl overflow-hidden bg-[#08090B] border border-[#08090B]/10 flex items-center justify-center ${
            expandedPreview ? 'max-h-[420px]' : 'h-56'
          }`}
        >
          <img
            src={previewUrl}
            alt={`Active input preview: ${title}`}
            data-testid="current-input-image-preview"
            className="w-full h-full object-contain block"
          />

          {highlightedVisualObs?.region && (
            <div
              aria-label={`Highlighted region: ${highlightedVisualObs.title}`}
              className="absolute border-2 border-[#FF4B4B] bg-[#FF4B4B]/20 pointer-events-none transition-all duration-200"
              style={{
                top: `${highlightedVisualObs.region.ymin / 10}%`,
                left: `${highlightedVisualObs.region.xmin / 10}%`,
                height: `${Math.max(
                  4,
                  (highlightedVisualObs.region.ymax - highlightedVisualObs.region.ymin) / 10
                )}%`,
                width: `${Math.max(
                  4,
                  (highlightedVisualObs.region.xmax - highlightedVisualObs.region.xmin) / 10
                )}%`,
              }}
            >
              <span className="absolute -top-5 left-0 bg-[#FF4B4B] text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap">
                {highlightedVisualObs.title}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpandedPreview((e) => !e)}
            aria-label={expandedPreview ? 'Shrink preview' : 'Expand preview'}
            className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-xl bg-white/95 text-[#08090B] border border-[#08090B]/15 shadow flex items-center justify-center hover:bg-[#CDF22B] transition-colors cursor-pointer"
          >
            {expandedPreview ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {inputType === 'pdf' && pdfBytes && (
        <div className="rounded-2xl overflow-hidden border border-[#08090B]/10 bg-[#08090B]">
          <PdfCanvasPreview pdfBytes={pdfBytes} fileName={title} />
        </div>
      )}

      {inputType === 'text' && textSnippet !== undefined && (
        <div className="rounded-2xl bg-[#FAF8F3] border border-[#08090B]/10 p-3 font-sans text-xs text-[#08090B] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {textSnippet.trim() ? textSnippet : 'Text area is currently empty.'}
        </div>
      )}

      {/* Clean Spec Rows matching mockup */}
      <div className="space-y-2 pt-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[#525866] inline-flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#94A3B8]" />
            Type
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-[#ECFFB6]/65 text-[#08090B] font-mono text-[11px] font-semibold">
            {typeDisplay}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[#525866] inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#94A3B8]" />
            Source
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-[#ECFFB6]/65 text-[#08090B] font-mono text-[11px] font-semibold truncate max-w-[165px]">
            {sourceDisplay}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[#525866] inline-flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#94A3B8]" />
            Processing
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-[#ECFFB6]/65 text-[#0F766E] font-mono text-[11px] font-semibold">
            On Device (Browser)
          </span>
        </div>
      </div>

      {/* Action Buttons: Re-run / Clear */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#08090B]/8">
        <button
          type="button"
          disabled={isBusy || (inputType === 'text' && !(textSnippet ?? '').trim())}
          onClick={onAnalyze}
          className="flex-1 btn-tactile-secondary py-2 px-3 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          <Play className="w-3 h-3" />
          <span>{report ? 'Re-Run' : 'Analyze'}</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onClear}
          aria-label="Clear Input"
          className="px-3 py-2 rounded-xl border border-[#08090B]/12 text-[#525866] hover:text-[#FF4B4B] hover:border-[#FF4B4B]/40 font-mono text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </section>
  );
}
