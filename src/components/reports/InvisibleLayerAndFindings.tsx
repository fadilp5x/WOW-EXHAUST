import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  Info,
  Layers,
  MoveHorizontal,
  ShieldCheck,
  SkipForward,
} from 'lucide-react';
import type { AnyScanReport, ForensicFinding, ScanStatus } from '../../types/forensics';
import { getRiskThemeForReport } from '../../lib/riskTheme';

interface InvisibleLayerAndFindingsProps {
  report: AnyScanReport;
  highlightedFindingId: string | null;
  scanStatus?: ScanStatus;
  revealLimit?: number;
  onSkipReveal?: () => void;
  onSelectFinding?: (id: string) => void;
}

function getUrgencyWeight(finding: ForensicFinding): number {
  if (!finding.present) return 100;
  if (finding.id === 'where_gps') return 1;
  if (finding.id === 'device_serial' || finding.id === 'pdf_author') return 2;
  if (finding.category === 'OWNER SIGNALS' || finding.id === 'pdf_creator_producer') return 3;
  if (finding.category === 'WHEN') return 4;
  if (finding.category === 'DEVICE' || finding.category === 'DOCUMENT') return 5;
  return 6;
}

export function InvisibleLayerAndFindings({
  report,
  highlightedFindingId,
  scanStatus = 'complete',
  revealLimit,
  onSkipReveal,
  onSelectFinding,
}: InvisibleLayerAndFindingsProps) {
  const [dividerPercent, setDividerPercent] = useState(52);
  const [selectedRawKey, setSelectedRawKey] = useState<string | null>(null);
  const [copiedClean, setCopiedClean] = useState(false);
  const [expandedTextDetails, setExpandedTextDetails] = useState<Record<string, boolean>>({});

  const toggleTextDetail = (key: string) => {
    setExpandedTextDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const theme = getRiskThemeForReport(report);
  const presentFindings = report.findings.filter((f) => f.present);
  const sortedFindings = [...report.findings].sort(
    (a, b) => getUrgencyWeight(a) - getUrgencyWeight(b)
  );
  const visibleFindings =
    revealLimit !== undefined ? sortedFindings.slice(0, revealLimit) : sortedFindings;

  const handleCopyCleanText = async () => {
    if (report.kind !== 'text') return;
    try {
      await navigator.clipboard.writeText(report.normalizedText);
      setCopiedClean(true);
      window.setTimeout(() => setCopiedClean(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Findings Summary Banner */}
      <section
        aria-label="Main Findings Summary"
        className={`card-unseen p-4 transition-colors duration-300 ${theme.borderClass}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.pulseDotClass}`}
            />
            <h3 className={`font-mono text-xs tracking-[0.14em] font-bold uppercase ${theme.scoreTextClass}`}>
              {report.kind === 'text'
                ? `PATTERN DISTINCTIVENESS SUMMARY · ${report.patternBand}`
                : `MAIN FINDINGS SUMMARY · ${theme.label}`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {scanStatus === 'revealing' && onSkipReveal && (
              <button
                type="button"
                onClick={onSkipReveal}
                className="btn-tactile-lime px-2.5 py-1 text-[10px] inline-flex items-center gap-1 cursor-pointer"
              >
                <SkipForward className="w-3 h-3" />
                <span>Show All</span>
              </button>
            )}
            <span className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full border font-bold ${theme.badgeClass}`}>
              {report.kind === 'text'
                ? `INDEX ${report.patternStrengthIndex}/100`
                : `${report.risk.score}/100 · ${presentFindings.length} PRESENT`}
            </span>
          </div>
        </div>

        <p className="mt-2 font-sans text-xs text-[#525866] leading-relaxed">
          {report.kind === 'text'
            ? report.interpretationNotice
            : report.risk.score >= 80
              ? `Critical metadata exposure detected (${presentFindings.length} field(s)). Anyone receiving the unmodified file can extract these details. Scrubbing recommended before sharing.`
              : report.risk.score >= 55
                ? `High metadata exposure (${presentFindings.length} field(s)). Device identifiers or creator tags are embedded in the file.`
                : report.risk.score >= 25
                  ? `Moderate exposure (${presentFindings.length} field(s)). Partial timestamp, creator, or software metadata was found.`
                  : 'Low metadata exposure in parsed file headers. Still inspect visible file content manually before publishing.'}
        </p>
      </section>

      {/* THE INVISIBLE LAYER (Image draggable split view) */}
      {report.kind === 'image' && report.previewUrl && (
        <section
          aria-label="The Invisible Layer comparison"
          className="card-unseen p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-xs tracking-[0.14em] font-bold text-[#08090B] uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00545F]" />
              THE INVISIBLE LAYER
            </h3>
            <span className="font-mono text-[10px] text-[#525866]">
              DRAG SLIDER · VISIBLE vs EMBEDDED METADATA
            </span>
          </div>

          <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl border border-[#08090B]/12 bg-[#08090B] select-none">
            <div className="absolute inset-0 p-4 overflow-y-auto bg-[#FAF8F3]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] tracking-widest text-[#FF4B4B] font-bold">
                  WHAT THE FILE CARRIES
                </span>
                <span className="font-mono text-[10px] text-[#525866]">
                  {presentFindings.length} EXPOSED FIELDS
                </span>
              </div>

              {presentFindings.length === 0 ? (
                <p className="font-mono text-xs text-[#0F766E] mt-6 font-bold">
                  NO EMBEDDED EXIF / XMP METADATA DETECTED IN THIS FILE.
                </p>
              ) : (
                <div className="space-y-2">
                  {presentFindings.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-[#08090B]/10 bg-white px-3 py-2 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px] text-[#525866]">
                        <span>{f.category}</span>
                        <span className="text-[#00545F] font-semibold">{f.sourceTag}</span>
                      </div>
                      <div className="text-[#08090B] font-semibold mt-0.5 truncate">
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="absolute inset-0 bg-[#08090B] overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - dividerPercent}% 0 0)` }}
            >
              <img
                src={report.previewUrl}
                alt={`Preview of ${report.fileName}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain bg-[#08090B]"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#08090B]/85 border border-white/15 font-mono text-[10px] text-white flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-[#CDF22B]" />
                WHAT YOU SEE
              </div>
            </div>

            <div
              className="absolute inset-y-0 w-0.5 bg-[#CDF22B] pointer-events-none"
              style={{ left: `${dividerPercent}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#CDF22B] border-2 border-[#08090B] text-[#08090B] flex items-center justify-center shadow-md">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>

            <input
              type="range"
              min={5}
              max={95}
              value={dividerPercent}
              aria-label="Compare visible image against hidden metadata"
              onChange={(e) => setDividerPercent(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />
          </div>
        </section>
      )}

      {/* Text Fingerprint Plain-Language Metrics & Clean Copy */}
      {report.kind === 'text' && (
        <section className="card-unseen border-[#00545F]/25 p-5 space-y-4">
          <div>
            <h3 className="font-mono text-xs tracking-[0.14em] text-[#00545F] uppercase font-bold">
              UNDERSTANDABLE WRITING PATTERN MEASUREMENTS
            </h3>
            <p className="font-sans text-xs text-[#525866] mt-0.5">
              Measured locally on your text ({report.metrics.wordCount} words across {report.metrics.sentenceCount} sentences). Describes structure only—not authorship or AI probability.
            </p>
          </div>

          {report.tooShortForMetrics && (
            <div
              role="note"
              className="rounded-2xl border border-[#F59E0B]/50 bg-[#FFFBEB] p-3 flex items-start gap-2 text-xs text-[#92400E]"
            >
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <strong className="font-mono text-[11px] block">
                  SHORT SAMPLE NOTICE (&lt; 15 WORDS)
                </strong>
                <span>
                  This snippet has only {report.metrics.wordCount} word(s). Statistical metrics like vocabulary variety fluctuate sharply on short passages.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: 'avg_len',
                title: 'AVERAGE SENTENCE LENGTH',
                value: `${report.metrics.meanSentenceLength} words`,
                plain: 'How many words you typically use in one sentence.',
                tech: 'Arithmetic mean of word tokens segmented per sentence delimiter.',
              },
              {
                key: 'len_var',
                title: 'SENTENCE LENGTH VARIATION',
                value: `${report.metrics.sentenceLengthVariance}`,
                plain: 'How much your sentences differ in length from one to the next.',
                tech: 'Population variance across measured sentence lengths.',
              },
              {
                key: 'vocab',
                title: 'VOCABULARY VARIETY',
                value: `${Math.round(report.metrics.lexicalDiversity * 100)}% (${report.metrics.lexicalDiversity})`,
                plain: 'The proportion of distinct words compared with all words in this sample.',
                tech: 'Type-Token Ratio (TTR = unique words / total words). Sensitive to text length.',
              },
              {
                key: 'func_words',
                title: 'COMMON CONNECTING WORDS',
                value: `${Math.round(report.metrics.functionWordRatio * 100)}% of text`,
                plain: "How frequently you use words such as 'the', 'and', 'of', and 'to'.",
                tech: 'Ratio of closed-class function words relative to total words.',
              },
              {
                key: 'repeated',
                title: 'REPEATED WORD PATTERNS',
                value:
                  report.metrics.repeatedPhrases.length > 0
                    ? report.metrics.repeatedPhrases
                        .slice(0, 2)
                        .map((p) => `"${p.phrase}" (${p.count}x)`)
                        .join(', ')
                    : 'No repeated sequences',
                plain: 'Short word sequences that occur multiple times in this text.',
                tech: `Detects 2-word and 3-word phrases appearing 2+ times, plus punctuation density (${report.metrics.punctuationPer100Words}/100 words).`,
              },
            ].map((card) => {
              const isOpen = Boolean(expandedTextDetails[card.key]);
              return (
                <div
                  key={card.key}
                  className="rounded-2xl bg-[#FAF8F3] border border-[#08090B]/10 p-3.5 space-y-1.5 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-mono text-[10px] tracking-wider text-[#00545F] font-bold block">
                      {card.title}
                    </span>
                    <div className="font-display text-xl font-bold text-[#08090B] mt-0.5 tabular-nums">
                      {card.value}
                    </div>
                    <p className="font-sans text-xs text-[#525866] mt-1 leading-snug">
                      {card.plain}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-[#08090B]/8">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleTextDetail(card.key)}
                      className="font-mono text-[10px] text-[#00545F] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3 h-3" />
                      {isOpen ? 'Hide technical note' : 'Technical note & limit'}
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isOpen && (
                      <p className="mt-1 font-sans text-[11px] text-[#525866] leading-snug">
                        {card.tech}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {report.metrics.topFunctionWords.length > 0 && (
            <div className="rounded-2xl bg-[#FAF8F3] border border-[#08090B]/10 p-3.5 space-y-2">
              <span className="font-mono text-[10px] tracking-wider text-[#00545F] font-bold uppercase block">
                TOP CONNECTING WORDS FREQUENCY
              </span>
              <div className="space-y-1.5">
                {report.metrics.topFunctionWords.map((fw) => {
                  const maxCount = report.metrics.topFunctionWords[0]?.count || 1;
                  const pct = Math.max(8, Math.round((fw.count / maxCount) * 100));
                  return (
                    <div key={fw.word} className="flex items-center gap-3 font-mono text-xs">
                      <span className="w-12 text-[#08090B] font-semibold">{fw.word}</span>
                      <div className="flex-1 h-2 rounded-full bg-white border border-[#08090B]/10 overflow-hidden">
                        <div className="h-full bg-[#00545F] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-[#525866] tabular-nums">{fw.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clean-copy text normalizer */}
          <div id="clean-copy-section" className="rounded-2xl bg-[#F0FDFA] border border-[#00545F]/25 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-[#08090B] font-bold">
                TEXT NORMALIZATION (CLEAN COPY)
              </span>
              <button
                type="button"
                onClick={handleCopyCleanText}
                className="btn-tactile-lime px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedClean ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedClean ? 'Copied Clean Text' : 'Copy Clean Text'}
              </button>
            </div>
            <p className="font-sans text-[11px] text-[#525866]">
              Converts smart quotation marks, non-breaking spaces, zero-width characters, and irregular whitespace into clean plain text. Formatting cleanup only—does not anonymize writing style.
            </p>
            {report.normalizationChanges.length > 0 && (
              <ul className="list-disc list-inside font-mono text-[11px] text-[#00545F] space-y-0.5">
                {report.normalizationChanges.map((ch, i) => (
                  <li key={i}>{ch}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* PDF Revision Honesty Notice */}
      {report.kind === 'pdf' && (
        <div className="card-unseen p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2 font-mono text-xs">
            <span className="text-[#00545F] font-bold">
              PDF DOCUMENT PROPERTIES · {report.pageCount} PAGE{report.pageCount === 1 ? '' : 'S'}
            </span>
            <span className="text-[#525866]">
              {report.structuralFlags.incrementalUpdatesCount} %%EOF MARKER(S)
            </span>
          </div>
          <p className="font-sans text-xs text-[#525866] leading-relaxed">
            {report.revisionNotice}
          </p>
        </div>
      )}

      {/* Verified Metadata Findings Table */}
      <section
        aria-label="Normalized Forensic Findings"
        className="card-unseen p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs tracking-[0.14em] font-bold text-[#08090B] uppercase">
            VERIFIED METADATA FINDINGS
          </h3>
          <span className="font-mono text-[11px] text-[#525866] font-semibold">
            {presentFindings.length} / {report.findings.length} PRESENT
          </span>
        </div>

        <div className="space-y-2">
          {visibleFindings.map((finding) => {
            const isHighlighted = highlightedFindingId === finding.id;
            const isCriticalRow =
              finding.present && (finding.id === 'where_gps' || finding.id === 'device_serial');
            return (
              <div
                key={finding.id}
                id={`finding-row-${finding.id}`}
                onClick={() => onSelectFinding?.(finding.id)}
                className={`rounded-2xl border p-3 transition-colors cursor-pointer ${
                  isHighlighted
                    ? 'bg-[#ECFFB6]/45 border-[#95ba07] ring-1 ring-[#95ba07]'
                    : isCriticalRow
                      ? 'bg-[#FFF2F2] border-[#FF4B4B]/40 hover:border-[#FF4B4B]'
                      : finding.present
                        ? 'bg-[#FFFBEB] border-[#F59E0B]/35 hover:border-[#F59E0B]'
                        : 'bg-[#FAF8F3] border-[#08090B]/8'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {finding.present ? (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isCriticalRow ? 'bg-[#FF4B4B]' : 'bg-[#F59E0B]'
                        }`}
                      />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-[#12A36B] shrink-0" />
                    )}
                    <span className="font-mono text-[10px] tracking-wider text-[#525866] font-semibold w-24 shrink-0">
                      {finding.category}
                    </span>
                    <span className="font-display text-xs font-bold text-[#08090B]">
                      {finding.label}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRawKey((prev) =>
                        prev === (finding.rawKey ?? finding.id)
                          ? null
                          : (finding.rawKey ?? finding.id)
                      );
                    }}
                    className="font-mono text-[10px] px-2 py-0.5 rounded-lg bg-white border border-[#08090B]/12 hover:border-[#08090B] text-[#525866] hover:text-[#08090B] transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Code2 className="w-3 h-3" />
                    {finding.sourceTag}
                  </button>
                </div>

                <div className="mt-1.5 font-mono text-xs break-all">
                  <span
                    className={
                      finding.present
                        ? isCriticalRow
                          ? 'text-[#B91C1C] font-bold'
                          : 'text-[#08090B] font-semibold'
                        : 'text-[#94A3B8]'
                    }
                  >
                    {finding.value}
                  </span>
                </div>

                <p className="mt-1 font-sans text-[11px] text-[#525866]">
                  {finding.explanation}
                </p>
              </div>
            );
          })}
        </div>

        {'rawMetadata' in report && (
          <div className="rounded-2xl border border-[#08090B]/10 bg-[#08090B] text-[#FAF8F3] p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-[10px] tracking-wider text-[#CDF22B]">
                LOCAL PARSED METADATA JSON {selectedRawKey ? `· FOCUSED: ${selectedRawKey}` : ''}
              </span>
              {selectedRawKey && (
                <button
                  type="button"
                  onClick={() => setSelectedRawKey(null)}
                  className="font-mono text-[10px] text-[#CDF22B] hover:underline cursor-pointer"
                >
                  SHOW ALL
                </button>
              )}
            </div>
            <pre className="font-mono text-[11px] text-[#FAF8F3]/85 max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {selectedRawKey && selectedRawKey in report.rawMetadata
                ? JSON.stringify(
                    { [selectedRawKey]: report.rawMetadata[selectedRawKey] },
                    null,
                    2
                  )
                : JSON.stringify(report.rawMetadata, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
