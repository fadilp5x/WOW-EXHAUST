import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Radar,
  RotateCcw,
  SkipForward,
  Type,
  Upload,
  XCircle,
} from 'lucide-react';
import type { ScanStageEntry, ScanStatus } from '../../types/forensics';

export type ScanInputMode = 'file' | 'text';

interface DropzoneTerminalProps {
  inputMode: ScanInputMode;
  onInputModeChange: (mode: ScanInputMode) => void;
  textInput: string;
  onTextInputChange: (value: string) => void;
  scanStatus: ScanStatus;
  stages: ScanStageEntry[];
  terminalLines: string[];
  scanProgressStage: string;
  onFileSelected: (file: File) => void;
  onTextAnalyze: (text: string) => void;
  onLoadSample: (sample: 'gps' | 'device' | 'pdf' | 'text') => void;
  onCancelScan?: () => void;
  onRetryScan?: () => void;
  onNewScan?: () => void;
  onSkipReveal?: () => void;
  judgeMode?: boolean;
  compact?: boolean;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const STATUS_BADGE: Record<ScanStatus, { label: string; className: string }> = {
  idle: { label: 'READY', className: 'text-[#525866] border-[#08090B]/15 bg-[#FAF8F3]' },
  ready: { label: 'INPUT READY', className: 'text-[#08090B] border-[#95ba07] bg-[#ECFFB6]' },
  processing: { label: 'PROCESSING', className: 'text-[#08090B] border-[#95ba07] bg-[#CDF22B]' },
  revealing: { label: 'REVEALING RESULTS', className: 'text-[#00545F] border-[#00545F]/40 bg-[#CCFBF1]' },
  waiting_ai: { label: 'WAITING FOR AI', className: 'text-[#92400E] border-[#F59E0B] bg-[#FEF3C7]' },
  complete: { label: 'COMPLETE', className: 'text-[#065F46] border-[#12A36B]/40 bg-[#D1FAE5]' },
  cancelled: { label: 'CANCELLED', className: 'text-[#92400E] border-[#F59E0B] bg-[#FEF3C7]' },
  error: { label: 'PARSE ERROR', className: 'text-[#B91C1C] border-[#FF4B4B] bg-[#FFE5E5]' },
};

export function DropzoneTerminal({
  inputMode,
  onInputModeChange,
  textInput,
  onTextInputChange,
  scanStatus,
  stages,
  terminalLines,
  scanProgressStage,
  onFileSelected,
  onTextAnalyze,
  onLoadSample,
  onCancelScan,
  onRetryScan,
  onNewScan,
  onSkipReveal,
  judgeMode = false,
  compact = false,
}: DropzoneTerminalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isScanning = scanStatus === 'processing';
  const isRevealing = scanStatus === 'revealing';
  const showExpandedPipeline = pipelineExpanded || (scanStatus !== 'complete' && scanStatus !== 'idle');

  const validateAndDispatchFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;

    const lower = file.name.toLowerCase();
    const validMime =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'image/webp' ||
      file.type === 'application/pdf' ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.pdf');

    if (!validMime) {
      setFileError('Unsupported format. Accepted formats: JPEG, PNG, WebP, or PDF.');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError('File exceeds the 25 MB browser-side processing limit.');
      return;
    }

    onFileSelected(file);
  };

  const badge = STATUS_BADGE[scanStatus];

  return (
    <section
      aria-label="UPLOAD YOUR FILE HERE"
      className="card-unseen p-4 sm:p-5 flex flex-col gap-3.5"
    >
      {/* Mode switcher: File vs Paste Text */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex bg-[#FAF8F3] border border-[#08090B]/10 rounded-2xl p-1 gap-1">
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onInputModeChange('file')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
              inputMode === 'file'
                ? 'bg-[#08090B] text-[#CDF22B] font-bold shadow-xs'
                : 'text-[#525866] hover:text-[#08090B]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            FILE X-RAY
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onInputModeChange('text')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
              inputMode === 'text'
                ? 'bg-[#08090B] text-[#CDF22B] font-bold shadow-xs'
                : 'text-[#525866] hover:text-[#08090B]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            TEXT FINGERPRINT
          </button>
        </div>

        <span className="font-mono text-[10px] text-[#525866]">
          ON DEVICE · MAX 25 MB
        </span>
      </div>

      {inputMode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            validateAndDispatchFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
            compact ? 'p-3' : 'p-5 sm:p-7'
          } ${
            isDragging
              ? 'border-[#95ba07] bg-[#ECFFB6]/40'
              : 'border-[#08090B]/15 bg-[#FAF8F3] hover:border-[#08090B]/35'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            aria-label="Choose image or PDF file to scan"
            onChange={(e) => {
              validateAndDispatchFile(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="sr-only"
          />

          {compact ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-[#ECFFB6] border border-[#95ba07]/40 flex items-center justify-center text-[#08090B] shrink-0">
                  {isScanning ? <Radar className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-[#08090B] leading-tight">
                    UPLOAD YOUR FILE HERE
                  </h2>
                  <p className="font-mono text-[10px] text-[#525866] truncate">
                    JPEG · PNG · WEBP · PDF (Drop or choose new file)
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="btn-tactile-lime px-3.5 py-2 text-xs cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isScanning ? 'Scanning...' : 'Choose File'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#ECFFB6] border border-[#95ba07]/40 flex items-center justify-center text-[#08090B]">
                {isScanning ? (
                  <Radar className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#08090B]">
                  UPLOAD YOUR FILE HERE
                </h2>
                <p className="mt-1 font-sans text-xs sm:text-sm text-[#525866]">
                  Drag and drop an image or PDF, or choose a file from your device. Original bytes never leave your browser.
                </p>
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="btn-tactile-lime px-5 py-2.5 text-xs cursor-pointer disabled:opacity-50"
              >
                {isScanning ? 'SCANNING...' : 'CHOOSE FILE'}
              </button>

              <p className="font-mono text-[10px] text-[#525866]">
                SUPPORTED: JPEG · PNG · WEBP · PDF (MAX 25 MB)
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#08090B]/12 bg-[#FAF8F3] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="exhaust-text-input"
              className="font-display text-base font-bold text-[#08090B]"
            >
              Paste Text for Pattern Lab
            </label>
            <span className="font-mono text-[10px] text-[#525866] tabular-nums">
              {textInput.length} chars
            </span>
          </div>
          <textarea
            id="exhaust-text-input"
            rows={compact ? 3 : 5}
            value={textInput}
            onChange={(e) => onTextInputChange(e.target.value)}
            placeholder="Paste a post, email draft, or paragraph to measure writing patterns and normalize hidden characters..."
            className="w-full bg-white border border-[#08090B]/15 rounded-xl focus:border-[#08090B] focus:outline-none p-2.5 font-sans text-xs text-[#08090B] placeholder:text-[#94A3B8]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-sans text-[11px] text-[#525866]">
              100% deterministic in browser. Never claims AI detection or authorship.
            </p>
            <button
              type="button"
              disabled={!textInput.trim() || isScanning}
              onClick={() => onTextAnalyze(textInput)}
              className="btn-tactile-lime px-4 py-2 text-xs disabled:opacity-40 cursor-pointer"
            >
              {isScanning ? 'Analyzing...' : 'Analyze Patterns'}
            </button>
          </div>
        </div>
      )}

      {fileError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#FF4B4B]/50 bg-[#FFF2F2] px-3 py-2 font-mono text-xs text-[#B91C1C]"
        >
          {fileError}
        </div>
      )}

      {/* JUDGE LIVE SAMPLES bar */}
      <div
        className={`rounded-2xl border p-3 transition-colors ${
          judgeMode
            ? 'border-[#95ba07] bg-[#ECFFB6]/45'
            : 'border-[#08090B]/8 bg-[#FAF8F3]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono text-[10px] tracking-wider text-[#08090B] font-bold uppercase">
            JUDGE LIVE SAMPLES
          </span>
          <span className="font-mono text-[10px] text-[#525866]">
            {judgeMode ? 'DEMO READY' : 'SYNTHETIC ASSETS'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onLoadSample('gps')}
            className="px-2.5 py-2 rounded-xl bg-white border border-[#08090B]/10 hover:border-[#08090B] disabled:opacity-50 text-left font-mono text-[11px] text-[#08090B] transition-colors cursor-pointer"
          >
            <span className="block text-[#00545F] text-[9px] font-bold">SAMPLE</span>
            <span className="font-semibold">Phone GPS</span>
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onLoadSample('device')}
            className="px-2.5 py-2 rounded-xl bg-white border border-[#08090B]/10 hover:border-[#08090B] disabled:opacity-50 text-left font-mono text-[11px] text-[#08090B] transition-colors cursor-pointer"
          >
            <span className="block text-[#00545F] text-[9px] font-bold">SAMPLE</span>
            <span className="font-semibold">Device EXIF</span>
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onLoadSample('pdf')}
            className="px-2.5 py-2 rounded-xl bg-white border border-[#08090B]/10 hover:border-[#08090B] disabled:opacity-50 text-left font-mono text-[11px] text-[#08090B] transition-colors cursor-pointer"
          >
            <span className="block text-[#00545F] text-[9px] font-bold">SAMPLE</span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <FileText className="w-3 h-3 shrink-0" />
              Resume PDF
            </span>
          </button>
          <button
            type="button"
            disabled={isScanning}
            onClick={() => onLoadSample('text')}
            className="px-2.5 py-2 rounded-xl bg-white border border-[#08090B]/10 hover:border-[#08090B] disabled:opacity-50 text-left font-mono text-[11px] text-[#08090B] transition-colors cursor-pointer"
          >
            <span className="block text-[#00545F] text-[9px] font-bold">SAMPLE</span>
            <span className="font-semibold">Text Post</span>
          </button>
        </div>
      </div>

      {/* Collapsible Staged Scan Pipeline */}
      {(stages.length > 0 || terminalLines.length > 0) && (
        <div
          aria-live="polite"
          data-testid="forensic-stage-log"
          className="rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] p-3 font-mono text-xs space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest text-[#525866] font-bold">
                PIPELINE
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badge.className}`}>
                {badge.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {isScanning && onCancelScan && (
                <button
                  type="button"
                  onClick={onCancelScan}
                  className="px-2 py-0.5 rounded-lg border border-[#FF4B4B] text-[#B91C1C] text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-3 h-3" />
                  CANCEL
                </button>
              )}
              {isRevealing && onSkipReveal && (
                <button
                  type="button"
                  onClick={onSkipReveal}
                  className="px-2 py-0.5 rounded-lg bg-[#CDF22B] text-[#08090B] font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <SkipForward className="w-3 h-3" />
                  SKIP
                </button>
              )}
              {(scanStatus === 'cancelled' || scanStatus === 'error') && onRetryScan && (
                <button
                  type="button"
                  onClick={onRetryScan}
                  className="px-2 py-0.5 rounded-lg bg-[#08090B] text-[#CDF22B] font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  RETRY
                </button>
              )}
              {(scanStatus === 'complete' || scanStatus === 'cancelled' || scanStatus === 'error') &&
                onNewScan && (
                  <button
                    type="button"
                    onClick={onNewScan}
                    className="px-2 py-0.5 rounded-lg border border-[#08090B]/15 text-[#525866] hover:text-[#08090B] text-[10px] cursor-pointer"
                  >
                    NEW SCAN
                  </button>
                )}
              {scanStatus === 'complete' && stages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPipelineExpanded((e) => !e)}
                  className="px-2 py-0.5 rounded-lg border border-[#08090B]/15 text-[#08090B] font-semibold text-[10px] cursor-pointer"
                >
                  {pipelineExpanded ? 'HIDE STAGES' : `STAGES (${stages.length})`}
                </button>
              )}
            </div>
          </div>

          {stages.length > 0 && showExpandedPipeline && (
            <div className="grid grid-cols-1 gap-1 text-[10px] pt-1">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-white border border-[#08090B]/8"
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0 text-[#08090B]">
                    {st.status === 'active' ? (
                      <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#00545F]" />
                    ) : st.status === 'done' ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-[#12A36B]" />
                    ) : st.status === 'error' ? (
                      <AlertCircle className="w-3 h-3 shrink-0 text-[#FF4B4B]" />
                    ) : (
                      <Circle className="w-3 h-3 shrink-0 text-[#94A3B8]" />
                    )}
                    <span className="truncate">{st.label}</span>
                  </span>
                  <span className="text-[9px] shrink-0 uppercase text-[#525866]">
                    {st.status === 'not_present' ? 'NOT PRESENT' : st.detail ?? st.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {terminalLines.length > 0 && showExpandedPipeline && (
            <div className="rounded-xl bg-[#08090B] p-2.5 text-[10px] space-y-0.5 max-h-24 overflow-y-auto">
              <div className="flex justify-between text-[#CDF22B]/70 mb-1">
                <span>LOCAL LOG</span>
                <span>{scanProgressStage}</span>
              </div>
              {terminalLines.map((line, i) => (
                <div
                  key={`${i}-${line}`}
                  className={
                    line.includes('GPS METADATA DETECTED')
                      ? 'text-[#FF4B4B]'
                      : line.includes('COMPLETE')
                        ? 'text-[#CDF22B]'
                        : 'text-[#FAF8F3]/85'
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
