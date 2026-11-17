import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type {
  AnyScanReport,
  Deduction,
  DefenderActionTarget,
  ProofOfScrub,
  ScanStatus,
} from '../../types/forensics';
import { getRiskThemeForReport } from '../../lib/riskTheme';
import { AgentXPanel } from '../agent/AgentXPanel';

interface ProfilerFeedProps {
  report: AnyScanReport | null;
  proof: ProofOfScrub | null;
  scanStatus: ScanStatus;
  deductions: Deduction[];
  deductionProvider: 'deterministic' | 'gemini' | 'deterministic-fallback';
  deductionNote?: string | null;
  isEnhancing: boolean;
  redteamMode: boolean;
  onToggleRedteam: () => void;
  onEnhanceWithGemini: () => void;
  onHighlightFinding?: (findingId: string) => void;
  onTriggerDefenderAction?: (target: DefenderActionTarget) => void;
}

export function ProfilerFeed({
  report,
  proof,
  scanStatus,
  deductions,
  deductionProvider,
  deductionNote,
  isEnhancing,
  redteamMode,
  onToggleRedteam,
  onEnhanceWithGemini,
  onHighlightFinding,
  onTriggerDefenderAction,
}: ProfilerFeedProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [revealedCount, setRevealedCount] = useState<number>(999);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setRevealedCount(999);
      return;
    }

    const total = Math.max(1, deductions.length);
    const step = Math.ceil(((5 - countdown + 1) / 5) * total);
    setRevealedCount(step);

    const timer = window.setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, deductions.length]);

  useEffect(() => {
    if (deductionProvider === 'gemini') {
      setDrawerOpen(true);
    }
  }, [deductionProvider]);

  const startReconstruction = () => {
    if (!redteamMode) {
      onToggleRedteam();
    }
    setDrawerOpen(true);
    setRevealedCount(1);
    setCountdown(5);
  };

  const visibleDeductions = deductions.slice(0, revealedCount);
  const theme = getRiskThemeForReport(report);

  return (
    <aside
      aria-label="AGENT X / DEFENDER INTELLIGENCE"
      className="flex flex-col gap-3"
    >
      {/* Primary Agent X Card matching the mockup's clean right rail */}
      <AgentXPanel
        report={report}
        proof={proof}
        scanStatus={scanStatus}
        redteamMode={redteamMode}
        isEnhancing={isEnhancing}
        onExplainWithGemini={() => {
          setDrawerOpen(true);
          onEnhanceWithGemini();
        }}
        showMoreControls={drawerOpen}
        onToggleMoreControls={() => setDrawerOpen((d) => !d)}
      />

      {/* Expandable Defender Cards & 5S Redteam Simulation Drawer */}
      <div className="card-unseen p-3.5 space-y-3">
        <button
          type="button"
          onClick={() => setDrawerOpen((d) => !d)}
          aria-expanded={drawerOpen}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div>
            <span className="font-mono text-[10px] tracking-[0.14em] text-[#00545F] uppercase font-bold block">
              {redteamMode ? 'EXPOSURE SIMULATION' : 'DEFENDER BREAKDOWN'}
            </span>
            <span className="font-display text-sm font-bold text-[#08090B]">
              {report
                ? `${deductions.length} Grounded Deduction Card${deductions.length === 1 ? '' : 's'}`
                : 'Awaiting Scan Deductions'}
            </span>
          </div>
          {drawerOpen ? (
            <ChevronUp className="w-4 h-4 text-[#525866]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#525866]" />
          )}
        </button>

        {drawerOpen && (
          <div className="space-y-3 pt-2 border-t border-[#08090B]/8">
            {/* Simulation & Redteam Banner */}
            <div className={`rounded-2xl border p-3 text-xs ${theme.urgencyBannerClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[10px] font-bold flex items-center gap-1">
                  {redteamMode ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#FF4B4B]" />
                      WHAT A RECIPIENT COULD SEE
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {report ? theme.label : 'READY FOR INSPECTION'}
                    </>
                  )}
                </span>
                {report && (
                  <button
                    type="button"
                    onClick={startReconstruction}
                    className="font-mono text-[10px] font-bold underline underline-offset-2 text-[#08090B] flex items-center gap-1 cursor-pointer"
                  >
                    <Timer className="w-3 h-3" />
                    {countdown !== null ? `${countdown}s...` : '5s Simulation'}
                  </button>
                )}
              </div>
              <p className="font-sans text-[11px] leading-snug">
                {redteamMode
                  ? 'Shows parsed metadata visible to anyone opening the raw file. Single fields do not prove identity.'
                  : 'Sorted urgent-first. Explains what was found, why it matters, and how to clean it.'}
              </p>
            </div>

            {/* Structured Defender Cards */}
            {!report ? (
              <p className="font-mono text-[11px] text-[#525866] text-center py-3">
                Load a file, PDF, or text post to view grounded Defender cards.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {visibleDeductions.map((item, idx) => {
                  const isTopUrgent = idx === 0 && (item.priorityRank ?? 99) <= 2 && report.kind !== 'text';
                  return (
                    <article
                      key={`${item.findingId}-${idx}`}
                      className={`rounded-2xl border p-3 space-y-2 ${
                        redteamMode || (isTopUrgent && report.risk.score >= 80)
                          ? 'border-[#FF4B4B]/45 bg-[#FFF2F2]'
                          : 'border-[#08090B]/10 bg-[#FAF8F3]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#08090B]/8 pb-1.5">
                        <span className="font-mono text-[10px] font-bold text-[#00545F]">
                          {isTopUrgent ? 'PRIORITY FINDING' : 'DEFENDER CARD'}
                        </span>
                        <span className="font-mono text-[9px] text-[#525866]">
                          {item.source === 'gemini' ? 'GEMINI GROUNDED' : 'LOCAL VERIFIED'}
                        </span>
                      </div>

                      <div>
                        <span className="font-mono text-[9px] uppercase text-[#525866] block">
                          What We Found
                        </span>
                        <p className="font-sans text-xs font-bold text-[#08090B]">
                          {item.whatWeFound ?? item.observation}
                        </p>
                      </div>

                      <div>
                        <span className="font-mono text-[9px] uppercase text-[#B45309] block">
                          Why It Matters
                        </span>
                        <p className="font-sans text-[11px] text-[#525866] leading-snug">
                          {item.whyItMatters ?? item.implication}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white border border-[#08090B]/8 p-2.5 space-y-1.5">
                        <span className="font-mono text-[9px] uppercase font-bold text-[#0F766E] block">
                          How To Fix It
                        </span>
                        <p className="font-sans text-[11px] text-[#08090B] leading-snug">
                          {item.howToFix ?? item.mitigation}
                        </p>
                        {item.actionTarget && item.actionTarget !== 'none' && onTriggerDefenderAction && (
                          <button
                            type="button"
                            onClick={() => onTriggerDefenderAction(item.actionTarget!)}
                            className="w-full btn-tactile-lime py-1.5 px-2.5 text-[11px] inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>{item.actionLabel ?? 'Take Action'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-sans text-[#B45309] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{item.uncertainty}</span>
                        </span>
                      </div>

                      <div className="pt-1 border-t border-[#08090B]/8 flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] text-[#525866]">SOURCE:</span>
                        <button
                          type="button"
                          onClick={() => onHighlightFinding?.(item.findingId)}
                          className="font-mono text-[10px] px-2 py-0.5 rounded-lg bg-white border border-[#08090B]/15 text-[#08090B] hover:border-[#08090B] cursor-pointer truncate max-w-[190px]"
                        >
                          {item.evidenceField}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {report && (
              <div className="pt-2 border-t border-[#08090B]/8 space-y-1.5">
                <button
                  type="button"
                  disabled={isEnhancing}
                  onClick={onEnhanceWithGemini}
                  className="w-full btn-tactile-secondary py-2 px-3 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00545F]" />
                  <span>{isEnhancing ? 'Generating...' : 'Refresh Gemini Explanations'}</span>
                </button>
                <p className="font-sans text-[10px] text-[#525866] leading-snug">
                  Consented minimized field list only (never file bytes or GPS).{' '}
                  {deductionProvider === 'gemini'
                    ? 'Active: Gemini API.'
                    : deductionNote || 'Deterministic local engine active.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
