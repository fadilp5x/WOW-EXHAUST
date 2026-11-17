import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AgentXState,
  AnyScanReport,
  ProofOfScrub,
  ScanStatus,
} from '../../types/forensics';
import {
  AGENT_X_QUESTIONS,
  type AgentXQuestionId,
  answerAgentXQuestion,
  buildAgentXPrimaryBriefing,
  deriveAgentXState,
} from '../../lib/agentX';
import agentXPortrait from '../../assets/images/agent_x_investigator_1794933786578.jpg';

interface AgentXPanelProps {
  report: AnyScanReport | null;
  proof: ProofOfScrub | null;
  scanStatus: ScanStatus;
  redteamMode: boolean;
  isEnhancing?: boolean;
  onExplainWithGemini?: () => void;
  showMoreControls?: boolean;
  onToggleMoreControls?: () => void;
}

const WAVE_BAR_HEIGHTS = [24, 48, 82, 40, 96, 65, 100, 52, 84, 38, 72, 44, 60, 30];

export function AgentXPanel({
  report,
  proof,
  scanStatus,
  redteamMode,
  isEnhancing = false,
  onExplainWithGemini,
  showMoreControls = false,
  onToggleMoreControls,
}: AgentXPanelProps) {
  const [qaOpen, setQaOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceSupported] = useState(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [hasUserInteractedVoice, setHasUserInteractedVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<AgentXQuestionId | null>(null);
  const [qaReply, setQaReply] = useState<string | null>(null);

  const primaryBriefing = buildAgentXPrimaryBriefing(report, proof);
  const activeTranscript = qaReply ?? primaryBriefing;
  const agentState: AgentXState = deriveAgentXState(scanStatus, report, isSpeaking);

  useEffect(() => {
    setActiveQuestion(null);
    setQaReply(null);
  }, [report?.id, proof?.verifiedAt]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (!voiceSupported || muted) return;
    setHasUserInteractedVoice(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.94;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleMute = () => {
    setHasUserInteractedVoice(true);
    setMuted((prev) => {
      const next = !prev;
      if (next && voiceSupported) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
      }
      return next;
    });
  };

  const handleStopSpeech = () => {
    if (!voiceSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    if (!voiceSupported || !isSpeaking) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleAskQuestion = (qId: AgentXQuestionId) => {
    setActiveQuestion(qId);
    const answer = answerAgentXQuestion(qId, report, proof);
    setQaReply(answer);
    if (hasUserInteractedVoice && !muted) {
      speakText(answer);
    }
  };

  const checklistSteps = [
    { label: 'Reading file...', done: Boolean(report) || scanStatus !== 'idle' },
    { label: 'Extracting metadata...', done: Boolean(report) },
    { label: 'Analyzing location...', done: Boolean(report) },
    { label: 'Building deductions...', done: Boolean(report) && scanStatus === 'complete', active: scanStatus === 'processing' || scanStatus === 'revealing' || scanStatus === 'waiting_ai' },
    { label: 'Preparing recommendations...', done: Boolean(report) && scanStatus === 'complete' },
  ];
  const completedSteps = checklistSteps.filter((s) => s.done).length;

  const hasGps = report?.kind === 'image' && Boolean(report.gps);
  const calloutTitle = !report
    ? 'Standby Mode'
    : proof && proof.cleanedScore < 25
      ? 'Metadata Removed'
      : hasGps
        ? 'Location Found'
        : report.kind === 'text'
          ? 'Writing Patterns'
          : report.risk.score >= 55
            ? 'Metadata Exposure Found'
            : 'Scan Complete';

  const recommendedActionText = !report
    ? 'Drop a photo, PDF, or text sample to inspect hidden details locally.'
    : proof && proof.cleanedScore < 25
      ? 'Your cleaned copy passed verification and is ready to download.'
      : hasGps
        ? 'Remove location metadata before sharing.'
        : report.kind === 'text'
          ? 'Normalize smart quotes and whitespace in Findings if desired.'
          : 'Review detected metadata fields and clean before publishing.';

  return (
    <section
      aria-label="AGENT X ASSISTANT"
      className="card-unseen overflow-hidden flex flex-col"
    >
      {/* Top Investigator Portrait Banner with LIVE dot + Waveform Overlay */}
      <div className="relative h-36 sm:h-40 bg-[#08090B] overflow-hidden">
        <img
          src={agentXPortrait}
          alt="Agent X Forensic Guide"
          className="w-full h-full object-cover object-top opacity-90"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#08090B] via-transparent to-[#08090B]/40"
        />

        {/* LIVE pill top-right */}
        <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-[#08090B]/85 border border-white/15 font-mono text-[10px] font-bold text-white inline-flex items-center gap-1.5 backdrop-blur-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              redteamMode ? 'bg-[#FF4B4B] exhaust-controlled-pulse' : 'bg-[#CDF22B]'
            }`}
          />
          {agentState === 'STANDBY' ? 'LIVE' : agentState}
        </span>

        {/* Animated Lime Audio Waveform Overlay */}
        <div
          aria-hidden="true"
          className="absolute bottom-2.5 inset-x-10 h-6 flex items-end justify-center gap-1"
        >
          {WAVE_BAR_HEIGHTS.map((base, idx) => {
            const activeH = isSpeaking
              ? Math.max(25, ((base + idx * 19) % 90) + 10)
              : scanStatus === 'processing' || isEnhancing
                ? Math.max(25, ((base + idx * 13) % 80) + 15)
                : Math.round(base * 0.42);
            return (
              <span
                key={idx}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isSpeaking
                    ? 'bg-[#D6FB00] animate-pulse'
                    : redteamMode
                      ? 'bg-[#FF4B4B]'
                      : 'bg-[#CDF22B]'
                }`}
                style={{ height: `${activeH}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3.5">
        {/* Title + Voice Icon Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#08090B] leading-tight">
              Agent X
            </h2>
            <p className="font-sans text-xs text-[#525866]">
              Your Forensic Guide
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!voiceSupported || muted}
              onClick={() => speakText(activeTranscript)}
              title="Read Agent X briefing aloud"
              aria-label="Speak Agent X findings"
              className="w-9 h-9 rounded-full bg-[#ECFFB6] hover:bg-[#CDF22B] text-[#08090B] flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute Agent X voice' : 'Mute Agent X voice'}
              title={muted ? 'Unmute Agent X voice' : 'Mute Agent X voice'}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                muted
                  ? 'bg-[#FFE5E5] border-[#FF4B4B]/40 text-[#B91C1C]'
                  : 'bg-[#FAF8F3] border-[#08090B]/10 text-[#08090B] hover:bg-[#ECFFB6]'
              }`}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* TTS Active Playback Mini-Controls */}
        {isSpeaking && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-[#ECFFB6]/65 px-2.5 py-1.5 font-mono text-[10px]">
            <span className="font-bold text-[#08090B]">Speaking briefing...</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePauseResume}
                className="px-2 py-0.5 rounded-lg bg-white border border-[#08090B]/15 cursor-pointer inline-flex items-center gap-1"
              >
                {isPaused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={handleStopSpeech}
                className="px-2 py-0.5 rounded-lg bg-[#FFE5E5] text-[#B91C1C] cursor-pointer inline-flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5" />
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Live Stage Checklist */}
        <div className="rounded-2xl border border-[#08090B]/8 bg-[#FAF8F3] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-sans">
            <span className="font-semibold text-[#08090B] inline-flex items-center gap-1.5">
              {scanStatus === 'processing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00545F]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#12A36B]" />
              )}
              {scanStatus === 'processing'
                ? 'Analyzing file...'
                : report
                  ? 'Analysis complete'
                  : 'Ready to scan'}
            </span>
            <span className="font-mono text-[11px] font-bold text-[#08090B] tabular-nums">
              {completedSteps} / 5
            </span>
          </div>

          <ul className="space-y-1 text-[11px] font-sans">
            {checklistSteps.map((step) => (
              <li
                key={step.label}
                className={`flex items-center gap-2 px-2 py-1 rounded-xl ${
                  step.active
                    ? 'bg-[#ECFFB6]/65 text-[#08090B] font-semibold'
                    : step.done
                      ? 'text-[#08090B]'
                      : 'text-[#94A3B8]'
                }`}
              >
                {step.active ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#00545F] shrink-0" />
                ) : step.done ? (
                  <CheckCircle2 className="w-3 h-3 text-[#12A36B] shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 text-[#CBD5E1] shrink-0" />
                )}
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Highlighted Grounded Alert Card */}
        <div
          aria-live="polite"
          className={`rounded-2xl border p-3.5 space-y-1 ${
            proof && proof.cleanedScore < 25
              ? 'bg-[#F2FBF6] border-[#12A36B]/35'
              : hasGps || (report && report.kind !== 'text' && report.risk.score >= 55)
                ? 'bg-[#FFF2F2] border-[#FF4B4B]/35'
                : 'bg-[#FAF8F3] border-[#08090B]/10'
          }`}
        >
          <span
            className={`font-display text-xs font-bold block ${
              proof && proof.cleanedScore < 25
                ? 'text-[#0F766E]'
                : hasGps || (report && report.kind !== 'text' && report.risk.score >= 55)
                  ? 'text-[#B91C1C]'
                  : 'text-[#08090B]'
            }`}
          >
            {calloutTitle}
          </span>
          <p className="font-sans text-xs text-[#08090B]/85 leading-relaxed">
            {activeTranscript}
          </p>
        </div>

        {/* Recommended Action */}
        <div className="space-y-1 px-0.5">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold text-[#08090B]">
            <ShieldCheck className="w-4 h-4 text-[#12A36B]" />
            <span>Recommended Action</span>
          </div>
          <p className="font-sans text-xs text-[#525866] leading-snug pl-5">
            {recommendedActionText}
          </p>
        </div>

        {/* Primary CTA Row: Explain This Finding + Overflow Q&A Trigger */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!report || isEnhancing}
            onClick={() => {
              if (onExplainWithGemini && report) {
                onExplainWithGemini();
              } else {
                setQaOpen((o) => !o);
              }
            }}
            className="flex-1 btn-tactile-dark py-2.5 px-4 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#CDF22B]" />
            <span>
              {isEnhancing ? 'Generating Explanations...' : 'Explain This Finding'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQaOpen((o) => !o);
              onToggleMoreControls?.();
            }}
            aria-expanded={qaOpen || showMoreControls}
            aria-label="Ask Agent X & inspect grounded Q&A"
            title="Ask Agent X Q&A & Defender Details"
            className="w-10 h-10 rounded-2xl border border-[#08090B]/15 bg-[#FAF8F3] hover:bg-[#ECFFB6] flex items-center justify-center text-[#08090B] cursor-pointer shrink-0"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Grounded Contextual Question Chips (toggled by '...' or quick toggle) */}
        <div className="pt-2 border-t border-[#08090B]/8 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-wider text-[#525866] font-semibold flex items-center gap-1 uppercase">
              <MessageSquare className="w-3 h-3 text-[#00545F]" />
              Ask Agent X (On-Device)
            </span>
            {qaReply && (
              <button
                type="button"
                onClick={() => {
                  setActiveQuestion(null);
                  setQaReply(null);
                }}
                className="font-mono text-[10px] text-[#00545F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AGENT_X_QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => handleAskQuestion(q.id)}
                className={`px-2.5 py-1 rounded-xl font-mono text-[10px] border transition-colors cursor-pointer ${
                  activeQuestion === q.id
                    ? 'bg-[#08090B] text-[#CDF22B] border-[#08090B] font-bold'
                    : 'bg-[#FAF8F3] border-[#08090B]/10 text-[#08090B] hover:border-[#08090B]/35'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
