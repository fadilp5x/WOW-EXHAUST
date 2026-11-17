import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import type { RiskBand, ScoreContribution } from '../../types/forensics';
import { getRiskThemeForScore } from '../../lib/riskTheme';

interface ExposureGaugeProps {
  mode: 'idle' | 'image' | 'pdf' | 'text';
  score: number;
  band?: RiskBand | string;
  statusWord?: 'PROTECTED' | 'VULNERABLE';
  contributions?: ScoreContribution[];
  methodologyNote?: string;
  tooShortText?: boolean;
  enlarged?: boolean;
  inline?: boolean;
}

export function ExposureGauge({
  mode,
  score,
  band = 'AWAITING INPUT',
  statusWord,
  contributions = [],
  methodologyNote,
  tooShortText = false,
  enlarged = false,
  inline = false,
}: ExposureGaugeProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 92;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  const isText = mode === 'text';
  const isIdle = mode === 'idle';
  const theme = getRiskThemeForScore(clamped, mode);

  const headingLabel = isText ? 'PATTERN DISTINCTIVENESS' : 'EXPOSURE RISK';

  const resolvedStatusWord = isIdle
    ? 'STANDBY'
    : isText
      ? tooShortText
        ? 'SHORT SAMPLE'
        : 'STYLE INDEX'
      : statusWord ?? (clamped >= 25 ? 'VULNERABLE' : 'PROTECTED');

  const gradientId = isText
    ? 'unseen-gauge-pattern'
    : clamped >= 55
      ? 'unseen-gauge-critical'
      : clamped >= 25
        ? 'unseen-gauge-moderate'
        : 'unseen-gauge-safe';

  return (
    <section
      aria-label={isText ? 'PATTERN DISTINCTIVENESS' : 'EXPOSURE GAUGE'}
      className={
        inline
          ? 'flex flex-col items-center'
          : `card-unseen p-4 sm:p-5 transition-all duration-300 ${theme.borderClass}`
      }
    >
      {/* SVG Semicircle Gauge */}
      <div className={`relative mx-auto w-full ${enlarged ? 'max-w-[270px]' : 'max-w-[232px]'}`}>
        <svg
          viewBox="0 0 220 140"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label={`${headingLabel}: ${isIdle ? 'idle' : `${clamped} out of 100`}, ${band}`}
        >
          <defs>
            <linearGradient id="unseen-gauge-critical" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CDF22B" />
              <stop offset="48%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FF4B4B" />
            </linearGradient>
            <linearGradient id="unseen-gauge-moderate" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CDF22B" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="unseen-gauge-safe" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CDF22B" />
              <stop offset="100%" stopColor="#12A36B" />
            </linearGradient>
            <linearGradient id="unseen-gauge-pattern" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#00545F" />
            </linearGradient>
          </defs>

          <path
            d="M 18 118 A 92 92 0 0 1 202 118"
            fill="none"
            stroke="#F1EFEA"
            strokeWidth="16"
            strokeLinecap="round"
          />

          <motion.path
            d="M 18 118 A 92 92 0 0 1 202 118"
            fill="none"
            stroke={isIdle ? '#E2E0D8' : `url(#${gradientId})`}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{
              strokeDashoffset: isIdle ? circumference : dashOffset,
            }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        {/* Center Score Readout */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center text-center pointer-events-none">
          <div className="font-display font-bold text-4xl sm:text-[42px] leading-none text-[#08090B] tabular-nums tracking-tight">
            {isIdle ? (
              <span className="text-[#94A3B8]">--</span>
            ) : (
              <span className="inline-flex items-baseline">
                <NumberFlow value={clamped} />
                {!isText && <span className="text-2xl font-bold ml-0.5">%</span>}
              </span>
            )}
          </div>

          <span
            className={`mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full border font-mono text-[10px] font-bold tracking-[0.08em] uppercase ${theme.badgeClass}`}
          >
            {isIdle ? 'STANDBY' : isText ? resolvedStatusWord : band}
          </span>

          <span className="mt-1.5 font-mono text-[10px] font-bold tracking-[0.14em] text-[#08090B] uppercase">
            {headingLabel}
          </span>
        </div>
      </div>

      {!inline && isIdle && (
        <p className="mt-3 text-xs font-sans text-[#525866] leading-snug border-t border-[#08090B]/8 pt-2.5 text-center">
          Choose a file, paste text, or load a sample to analyze locally.
        </p>
      )}

      {!inline && isText && (
        <p className="mt-3 text-[11px] font-sans text-[#00545F] bg-[#F0FDFA] border border-[#00545F]/20 rounded-2xl p-2.5 leading-snug">
          Measures stylistic structure only—not a privacy risk score, AI detection, or proof of authorship.
        </p>
      )}

      {!isIdle && !isText && contributions.length > 0 && (
        <div className="w-full mt-2.5 pt-2 border-t border-[#08090B]/8">
          <button
            type="button"
            onClick={() => setShowBreakdown((s) => !s)}
            aria-expanded={showBreakdown}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#525866] hover:text-[#08090B] transition-colors cursor-pointer py-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How This Score Works</span>
            {showBreakdown ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showBreakdown && (
            <div className="mt-2 space-y-1 text-[11px] font-mono bg-[#FAF8F3] border border-[#08090B]/8 rounded-2xl p-2.5">
              {contributions.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 px-1.5 py-0.5 rounded-lg ${
                    item.present ? 'text-[#08090B] font-semibold' : 'text-[#94A3B8]'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {item.present ? `+${item.points}` : '0'}
                  </span>
                </div>
              ))}
              {methodologyNote && (
                <p className="pt-1 text-[10px] font-sans text-[#525866] leading-snug">
                  {methodologyNote}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
