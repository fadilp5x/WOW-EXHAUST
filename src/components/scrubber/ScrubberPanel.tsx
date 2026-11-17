import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronsRight,
  Download,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AnyScanReport,
  ProofOfScrub,
  TimelineEvent,
} from '../../types/forensics';
import {
  inspectImageTransparency,
  scrubImageAndVerify,
  scrubPdfAndVerify,
} from '../../lib/scrubber';
import { getRiskThemeByTone } from '../../lib/riskTheme';

interface ScrubberPanelProps {
  report: AnyScanReport;
  sourceFile: File | null;
  proof: ProofOfScrub | null;
  timeline: TimelineEvent[];
  onScrubCompleted: (
    afterReport: AnyScanReport,
    proof: ProofOfScrub
  ) => void;
  highlighted?: boolean;
  compactDock?: boolean;
  onOpenProofTab?: () => void;
}

export function ScrubberPanel({
  report,
  sourceFile,
  proof,
  timeline,
  onScrubCompleted,
  highlighted = false,
  compactDock = false,
  onOpenProofTab,
}: ScrubberPanelProps) {
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [hasTransparency, setHasTransparency] = useState(false);
  const [applyNoise, setApplyNoise] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    let active = true;
    if (report.kind === 'image' && sourceFile) {
      inspectImageTransparency(sourceFile)
        .then((res) => {
          if (active) setHasTransparency(res.hasTransparency);
        })
        .catch(() => {
          if (active) setHasTransparency(false);
        });
    } else {
      setHasTransparency(false);
    }
    return () => {
      active = false;
    };
  }, [report.kind, sourceFile]);

  const handleRunScrub = async () => {
    if (!sourceFile) return;
    setIsScrubbing(true);

    try {
      if (report.kind === 'image') {
        const { afterReport, proof: nextProof } = await scrubImageAndVerify(
          sourceFile,
          report,
          {
            outputFormat,
            quality: 0.92,
            applyExperimentalNoise: applyNoise,
          }
        );
        onScrubCompleted(afterReport, nextProof);
        toast.success(
          `Verified clean copy: exposure score dropped ${nextProof.originalScore} -> ${nextProof.cleanedScore}.`
        );
      } else if (report.kind === 'pdf') {
        const buf = new Uint8Array(await sourceFile.arrayBuffer());
        const { afterReport, proof: nextProof } = await scrubPdfAndVerify(
          buf,
          report
        );
        onScrubCompleted(afterReport, nextProof);
        toast.success(
          `PDF metadata reduced: exposure score dropped ${nextProof.originalScore} -> ${nextProof.cleanedScore}.`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Local scrubbing failed.'
      );
    } finally {
      setIsScrubbing(false);
    }
  };

  if (report.kind === 'text') {
    if (compactDock) return null;
    return (
      <section className="card-unseen p-5 space-y-2 border-[#00545F]/25 bg-[#F0FDFA]">
        <h3 className="font-mono text-xs tracking-[0.14em] text-[#00545F] font-bold uppercase">
          TEXT NORMALIZATION
        </h3>
        <p className="font-sans text-xs text-[#08090B]">
          Text normalization replaces smart quotes, non-breaking spaces, and irregular whitespace inside Findings. Formatting cleanup does not anonymize writing style.
        </p>
      </section>
    );
  }

  const originalScore = proof ? proof.originalScore : report.risk.score;
  const originalCount = proof
    ? proof.originalMetadataCount
    : report.findings.filter((f) => f.present).length;
  const cleanedScore = proof ? proof.cleanedScore : 0;
  const cleanedCount = proof ? proof.remainingMetadataCount : 0;

  if (compactDock) {
    return (
      <section
        aria-label="One-Click Metadata Scrubber"
        className="card-unseen-dark p-4 sm:px-6 sm:py-4 flex flex-col gap-3"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Before -> After Comparison matching image.png bottom dark dock */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-7 flex-1">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-sans text-[#FAF8F3]">
                <FileText className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span className="font-semibold">Original File</span>
                <span className="text-[#94A3B8]">(This scan)</span>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="block text-[10px] font-sans text-[#94A3B8]">Risk Score</span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[#FF4B4B] tabular-nums">
                    {originalScore}%
                  </span>
                </div>
                <div className="h-7 w-px bg-white/15" />
                <div>
                  <span className="block text-[10px] font-sans text-[#94A3B8]">Metadata Items</span>
                  <span className="font-display text-sm sm:text-base font-bold text-white tabular-nums">
                    {originalCount} found
                  </span>
                </div>
              </div>
            </div>

            <ChevronsRight className="w-6 h-6 text-[#CDF22B] hidden sm:block shrink-0" />

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-sans text-[#FAF8F3]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CDF22B]" />
                <span className="font-semibold">Cleaned Copy</span>
                <span className="text-[#94A3B8]">
                  ({proof ? 'Verified' : 'Predicted'})
                </span>
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <span className="block text-[10px] font-sans text-[#94A3B8]">Risk Score</span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[#CDF22B] tabular-nums">
                    {cleanedScore}%
                  </span>
                </div>
                <div className="h-7 w-px bg-white/15" />
                <div>
                  <span className="block text-[10px] font-sans text-[#94A3B8]">Metadata Items</span>
                  <span className="font-display text-sm sm:text-base font-bold text-white tabular-nums">
                    {cleanedCount} found
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right CTA */}
          <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
            {proof?.cleanedBlobUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={proof.cleanedBlobUrl}
                  download={proof.cleanedFileName}
                  className="btn-tactile-lime px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Cleaned</span>
                </a>
                {onOpenProofTab && (
                  <button
                    type="button"
                    onClick={onOpenProofTab}
                    className="px-3 py-2.5 rounded-2xl border border-white/25 text-white hover:border-[#CDF22B] font-mono text-xs cursor-pointer"
                  >
                    Proof
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isScrubbing || !sourceFile}
                onClick={handleRunScrub}
                className="btn-tactile-lime px-6 py-2.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isScrubbing ? 'Cleaning...' : 'Clean This File'}</span>
              </button>
            )}
            <span className="font-mono text-[10px] text-[#94A3B8] text-center sm:text-right">
              {proof
                ? `Verified: ${proof.originalScore} -> ${proof.cleanedScore}`
                : 'Remove metadata & verify'}
            </span>
          </div>
        </div>

        {/* Inline Verified Summary Pill if scrubbed */}
        {proof && (
          <div
            data-testid="proof-of-scrub-panel"
            className="pt-2.5 border-t border-white/12 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
          >
            <span className="text-[#CDF22B] inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              VERIFIED RE-PARSE: {proof.removedFields.length} removed · {proof.remainingFields.length} remaining
            </span>
            <span className="text-[#94A3B8] text-[11px]">
              {proof.cleanedFileName} ({(proof.cleanedFileSize / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
      </section>
    );
  }

  const beforeTone = proof
    ? getRiskThemeByTone(proof.originalBand)
    : getRiskThemeByTone(report.risk.band);
  const afterTone = proof
    ? getRiskThemeByTone(proof.cleanedBand)
    : getRiskThemeByTone('LOW');

  return (
    <section
      aria-label="One-Click Metadata Scrubber"
      className={`card-unseen p-5 space-y-4 transition-colors duration-300 ${
        highlighted ? 'border-[#95ba07] ring-2 ring-[#CDF22B]' : afterTone.borderClass
      }`}
    >
      <div>
        <h3 className="font-display text-2xl font-bold text-[#08090B]">
          Clean This File & Verify Output
        </h3>
        <p className="font-sans text-xs text-[#525866] mt-0.5">
          Re-encodes your file in browser memory, strips embedded metadata, and re-runs the forensic parser on the generated copy to verify what changed.
        </p>
      </div>

      {/* Supported Operations Summary */}
      <div className="rounded-2xl border border-[#08090B]/8 bg-[#FAF8F3] p-3.5 font-mono text-[11px] text-[#525866] space-y-1">
        <span className="text-[#08090B] font-bold block">SUPPORTED LOCAL CLEANING OPERATIONS:</span>
        {report.kind === 'image' ? (
          <p>
            Strips EXIF GPS coordinates, camera serials, device make/model, timestamps, artist/copyright, software strings, and XMP/IPTC chunks via fresh Canvas pixel re-encoding.
          </p>
        ) : (
          <p>
            Clears PDF Info dictionary fields (Author, Title, Subject, Keywords, Creator, Producer, Dates) and rebuilds pages into a clean PDF container without incremental %%EOF history.
          </p>
        )}
      </div>

      {/* Image Scrub Controls */}
      {report.kind === 'image' && (
        <div className="rounded-2xl border border-[#08090B]/10 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="scrub-format-select" className="font-mono text-xs font-bold text-[#08090B]">
              OUTPUT FORMAT
            </label>
            <select
              id="scrub-format-select"
              value={outputFormat}
              onChange={(e) =>
                setOutputFormat(e.target.value as 'image/jpeg' | 'image/png' | 'image/webp')
              }
              className="bg-[#FAF8F3] border border-[#08090B]/15 rounded-xl px-3 py-1.5 font-mono text-xs text-[#08090B] focus:border-[#08090B]"
            >
              <option value="image/jpeg">JPEG (Quality 0.92 · Default)</option>
              <option value="image/png">PNG (Lossless · Preserves Alpha)</option>
              <option value="image/webp">WebP (Quality 0.92 · Preserves Alpha)</option>
            </select>
          </div>

          {hasTransparency && outputFormat === 'image/jpeg' && (
            <div
              role="alert"
              className="rounded-xl border border-[#F59E0B]/50 bg-[#FFFBEB] p-2.5 flex items-start gap-2 text-xs text-[#92400E]"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#F59E0B]" />
              <span>
                This image contains transparent pixels. Converting to JPEG flattens transparency onto white. Choose PNG or WebP to preserve alpha.
              </span>
            </div>
          )}

          <label className="flex items-start gap-2.5 pt-2 border-t border-[#08090B]/8 cursor-pointer">
            <input
              type="checkbox"
              checked={applyNoise}
              onChange={(e) => setApplyNoise(e.target.checked)}
              className="mt-1 accent-[#08090B]"
            />
            <span className="text-xs font-sans text-[#525866] leading-snug">
              <strong className="text-[#08090B] font-mono text-[11px]">
                Experimental Pixel LSB Perturbation (Disabled by default)
              </strong>{' '}
              — Applies sparse pixel variations. Not a guaranteed anti-recognition or privacy protection method.
            </span>
          </label>
        </div>
      )}

      {report.kind === 'pdf' && (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-3 text-xs font-sans text-[#92400E] space-y-1">
          <p className="font-mono text-[11px] font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            METADATA-REDUCED PDF OUTPUT LIMITATIONS
          </p>
          <p>
            Rebuilding pages removes Info dictionary fields, but does not guarantee removal of embedded files, annotations, form fields, digital signatures, or visible page text.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={isScrubbing || !sourceFile || (originalCount === 0 && Boolean(proof))}
        onClick={handleRunScrub}
        className="w-full btn-tactile-lime py-3.5 px-5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        <span>{isScrubbing ? 'CLEANING & RE-VERIFYING...' : 'CLEAN THIS FILE'}</span>
      </button>

      {/* Proof Comparison */}
      {proof && (
        <div
          data-testid="proof-of-scrub-panel"
          className="space-y-4 pt-3 border-t border-[#08090B]/10"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-2xl border p-4 space-y-1.5 ${beforeTone.surfaceBgClass} ${beforeTone.borderClass}`}>
              <span className={`font-mono text-[10px] tracking-widest block font-bold ${beforeTone.scoreTextClass}`}>
                ORIGINAL FILE (BEFORE)
              </span>
              <div className={`font-display text-3xl font-bold tabular-nums ${beforeTone.scoreTextClass}`}>
                <NumberFlow value={proof.originalScore} /> / 100
              </div>
              <div className="font-mono text-xs text-[#08090B]">Band: {proof.originalBand}</div>
              <div className="font-mono text-xs text-[#525866]">
                Metadata fields detected: {proof.originalMetadataCount}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 space-y-1.5 ${afterTone.surfaceBgClass} ${afterTone.borderClass}`}>
              <span className={`font-mono text-[10px] tracking-widest block font-bold ${afterTone.scoreTextClass}`}>
                CLEANED COPY (VERIFIED AFTER)
              </span>
              <div className={`font-display text-3xl font-bold tabular-nums ${afterTone.scoreTextClass}`}>
                <NumberFlow value={proof.cleanedScore} /> / 100
              </div>
              <div className="font-mono text-xs text-[#08090B]">
                Band: {proof.cleanedBand} · {proof.cleanedScore < 25 ? 'PROTECTED' : 'VULNERABLE'}
              </div>
              <div className="font-mono text-xs text-[#525866]">
                Remaining metadata fields: {proof.remainingMetadataCount}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#12A36B]/35 bg-[#F2FBF6] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-mono text-xs tracking-[0.12em] text-[#0F766E] font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                VERIFICATION RESULT: RE-PARSED OUTPUT
              </h4>
              <span className="font-mono text-[10px] text-[#525866]">
                {new Date(proof.verifiedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-white border border-[#08090B]/10 rounded-xl p-3">
                <span className="text-[10px] text-[#525866] block mb-1.5">
                  REMOVED FIELDS ({proof.removedFields.length})
                </span>
                {proof.removedFields.length === 0 ? (
                  <p className="text-[#525866]">No active tracked fields needed removal.</p>
                ) : (
                  <ul className="space-y-1 text-[#0F766E]">
                    {proof.removedFields.map((item) => (
                      <li key={item} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white border border-[#08090B]/10 rounded-xl p-3">
                <span className="text-[10px] text-[#525866] block mb-1.5">
                  REMAINING FIELDS ({proof.remainingFields.length})
                </span>
                {proof.remainingFields.length === 0 ? (
                  <p className="text-[#0F766E] font-semibold">NONE DETECTED BY LOCAL PARSER</p>
                ) : (
                  <ul className="space-y-1 text-[#B45309]">
                    {proof.remainingFields.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#08090B]/10 rounded-xl p-3 space-y-1 text-[11px] font-sans text-[#525866]">
              <p className="font-mono text-[10px] text-[#08090B] font-bold">
                METHOD: {proof.processingMethod}
              </p>
              {proof.knownLimitations.map((lim, i) => (
                <p key={i}>• {lim}</p>
              ))}
            </div>

            {proof.cleanedBlobUrl && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="font-mono text-xs text-[#08090B]">
                  {proof.cleanedFileName} ({(proof.cleanedFileSize / 1024).toFixed(1)} KB)
                </span>
                <a
                  href={proof.cleanedBlobUrl}
                  download={proof.cleanedFileName}
                  className="btn-tactile-lime px-4 py-2 text-xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Cleaned File
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="rounded-2xl border border-[#08090B]/10 bg-[#FAF8F3] p-3.5 space-y-2">
          <span className="font-mono text-[10px] tracking-widest text-[#525866] font-bold block">
            ON-DEVICE EXECUTION TIMELINE
          </span>
          <ol className="space-y-1 font-mono text-[11px]">
            {timeline.map((evt, idx) => (
              <li key={evt.id} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-[#00545F] font-bold">{String(idx + 1).padStart(2, '0')}.</span>
                  <div>
                    <span className="text-[#08090B] font-semibold">{evt.label}</span>{' '}
                    <span className="text-[#525866]">— {evt.detail}</span>
                  </div>
                </div>
                <span className="text-[#94A3B8] shrink-0 tabular-nums">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
