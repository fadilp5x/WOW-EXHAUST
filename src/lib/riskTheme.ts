import type { AnyScanReport, RiskBand } from '../types/forensics';

export type VisualSeverityTone =
  | 'IDLE'
  | 'LOW'
  | 'EXPOSED'
  | 'HIGH'
  | 'CRITICAL'
  | 'PATTERN';

export interface RiskThemeTokens {
  tone: VisualSeverityTone;
  label: string;
  headlineWord: string;
  panelBgClass: string;
  surfaceBgClass: string;
  borderClass: string;
  accentBorderClass: string;
  scoreTextClass: string;
  badgeClass: string;
  arcHex: string;
  pulseDotClass: string;
  urgencyBannerClass: string;
}

const THEME_MAP: Record<VisualSeverityTone, RiskThemeTokens> = {
  IDLE: {
    tone: 'IDLE',
    label: 'AWAITING INPUT',
    headlineWord: 'Ready',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#FAF8F3]',
    borderClass: 'border-[#08090B]/10',
    accentBorderClass: 'border-[#08090B]/20',
    scoreTextClass: 'text-[#525866]',
    badgeClass: 'bg-[#FAF8F3] border-[#08090B]/15 text-[#525866]',
    arcHex: '#E5E7EB',
    pulseDotClass: 'bg-[#94A3B8]',
    urgencyBannerClass: 'bg-[#FAF8F3] border-[#08090B]/10 text-[#525866]',
  },
  LOW: {
    tone: 'LOW',
    label: 'LOW EXPOSURE',
    headlineWord: 'Low',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#F4FDE8]',
    borderClass: 'border-[#12A36B]/35',
    accentBorderClass: 'border-[#12A36B]/70',
    scoreTextClass: 'text-[#0F766E]',
    badgeClass: 'bg-[#ECFFB6] border-[#12A36B]/35 text-[#08090B]',
    arcHex: '#12A36B',
    pulseDotClass: 'bg-[#12A36B]',
    urgencyBannerClass: 'bg-[#F2FBF6] border-[#12A36B]/30 text-[#065F46]',
  },
  EXPOSED: {
    tone: 'EXPOSED',
    label: 'MODERATE EXPOSURE',
    headlineWord: 'Moderate',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#FFFBEB]',
    borderClass: 'border-[#F59E0B]/45',
    accentBorderClass: 'border-[#F59E0B]/80',
    scoreTextClass: 'text-[#B45309]',
    badgeClass: 'bg-[#FEF3C7] border-[#F59E0B]/50 text-[#92400E]',
    arcHex: '#F59E0B',
    pulseDotClass: 'bg-[#F59E0B]',
    urgencyBannerClass: 'bg-[#FFFBEB] border-[#F59E0B]/40 text-[#92400E]',
  },
  HIGH: {
    tone: 'HIGH',
    label: 'HIGH EXPOSURE',
    headlineWord: 'Elevated',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#FFF4ED]',
    borderClass: 'border-[#F97316]/55',
    accentBorderClass: 'border-[#EA580C]/85',
    scoreTextClass: 'text-[#C2410C]',
    badgeClass: 'bg-[#FFEDD5] border-[#F97316]/60 text-[#9A3412]',
    arcHex: '#F97316',
    pulseDotClass: 'bg-[#F97316]',
    urgencyBannerClass: 'bg-[#FFF4ED] border-[#F97316]/45 text-[#9A3412]',
  },
  CRITICAL: {
    tone: 'CRITICAL',
    label: 'CRITICAL EXPOSURE',
    headlineWord: 'High',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#FFF2F2]',
    borderClass: 'border-[#FF4B4B]/45',
    accentBorderClass: 'border-[#FF4B4B]',
    scoreTextClass: 'text-[#FF4B4B]',
    badgeClass: 'bg-[#FFE5E5] border-[#FF4B4B]/45 text-[#B91C1C]',
    arcHex: '#FF4B4B',
    pulseDotClass: 'bg-[#FF4B4B] exhaust-controlled-pulse',
    urgencyBannerClass: 'bg-[#FFF2F2] border-[#FF4B4B]/35 text-[#991B1B]',
  },
  PATTERN: {
    tone: 'PATTERN',
    label: 'PATTERN DISTINCTIVENESS',
    headlineWord: 'Pattern',
    panelBgClass: 'bg-white',
    surfaceBgClass: 'bg-[#F0FDFA]',
    borderClass: 'border-[#00545F]/30',
    accentBorderClass: 'border-[#00545F]',
    scoreTextClass: 'text-[#00545F]',
    badgeClass: 'bg-[#CCFBF1] border-[#00545F]/30 text-[#00545F]',
    arcHex: '#00545F',
    pulseDotClass: 'bg-[#00545F]',
    urgencyBannerClass: 'bg-[#F0FDFA] border-[#00545F]/25 text-[#00545F]',
  },
};

export function resolveBandFromScore(score: number): RiskBand {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 25) return 'EXPOSED';
  return 'LOW';
}

export function getRiskThemeByTone(tone: VisualSeverityTone): RiskThemeTokens {
  return THEME_MAP[tone];
}

export function getRiskThemeForReport(report: AnyScanReport | null): RiskThemeTokens {
  if (!report) return THEME_MAP.IDLE;
  if (report.kind === 'text') return THEME_MAP.PATTERN;
  return THEME_MAP[report.risk.band];
}

export function getRiskThemeForScore(
  score: number,
  mode: 'idle' | 'image' | 'pdf' | 'text'
): RiskThemeTokens {
  if (mode === 'idle') return THEME_MAP.IDLE;
  if (mode === 'text') return THEME_MAP.PATTERN;
  return THEME_MAP[resolveBandFromScore(score)];
}
