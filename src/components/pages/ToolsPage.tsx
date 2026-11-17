import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSearch,
  GraduationCap,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';

type ToolCategory = 'all' | 'time' | 'student' | 'group' | 'privacy' | 'forensics';

interface ToolsPageProps {
  onLaunchScanner: (sample?: 'gps' | 'pdf' | 'text') => void;
}

const COMMON_CLAUSE_FLAGS = [
  {
    id: 'third_party_brokers',
    label: 'Shares telemetry or device identifiers with third-party data brokers',
    weight: 30,
  },
  {
    id: 'indefinite_retention',
    label: 'Retains uploaded content or activity logs indefinitely after deletion',
    weight: 25,
  },
  {
    id: 'cross_app_tracking',
    label: 'Tracks clipboard, location SDKs, or installed apps across other services',
    weight: 25,
  },
  {
    id: 'ai_training_default',
    label: 'Uses user uploads for external model training without explicit opt-in',
    weight: 20,
  },
];

export function ToolsPage({ onLaunchScanner }: ToolsPageProps) {
  const [filter, setFilter] = useState<ToolCategory>('all');

  // 01 Time Intelligence Queue Simulator
  const [waitMinutes, setWaitMinutes] = useState(14);
  const [switchesPerDay, setSwitchesPerDay] = useState(6);
  const [weeksPerYear, setWeeksPerYear] = useState(48);

  const annualHours = useMemo(() => {
    const minutesPerYear = (waitMinutes + switchesPerDay * 4) * 5 * weeksPerYear;
    return Math.round(minutesPerYear / 60);
  }, [switchesPerDay, waitMinutes, weeksPerYear]);

  // 02 Student Focus Matrix
  const [studyBlocks, setStudyBlocks] = useState([
    { id: '1', task: 'Deep Problem Set', plannedMin: 60, distractedMin: 12 },
    { id: '2', task: 'Reading & Notes', plannedMin: 45, distractedMin: 15 },
  ]);
  const [newTaskName, setNewTaskName] = useState('');

  const focusEfficiency = useMemo(() => {
    const totalPlanned = studyBlocks.reduce((acc, b) => acc + b.plannedMin, 0);
    const totalDistracted = studyBlocks.reduce((acc, b) => acc + b.distractedMin, 0);
    if (totalPlanned <= 0) return 100;
    return Math.max(0, Math.round(((totalPlanned - totalDistracted) / totalPlanned) * 100));
  }, [studyBlocks]);

  // 03 Group Contribution Analyzer (with explicit ethical guardrail)
  const [contributors, setContributors] = useState([
    { id: 'a', name: 'Member A', artifacts: 14, hours: 8 },
    { id: 'b', name: 'Member B', artifacts: 11, hours: 7 },
    { id: 'c', name: 'Member C', artifacts: 4, hours: 3 },
  ]);
  const totalArtifacts = contributors.reduce((s, c) => s + c.artifacts, 0) || 1;

  // 04 Privacy & Terms Analyzer
  const [selectedFlags, setSelectedFlags] = useState<string[]>([
    'third_party_brokers',
    'indefinite_retention',
  ]);
  const [customTermsText, setCustomTermsText] = useState('');

  const termsAnalysis = useMemo(() => {
    const keywordMatches: string[] = [];
    const lower = customTermsText.toLowerCase();
    if (lower.includes('third party') || lower.includes('affiliates') || lower.includes('partners')) {
      keywordMatches.push('Broad "third-party / affiliate" data sharing language detected');
    }
    if (lower.includes('irrevocable') || lower.includes('perpetual') || lower.includes('worldwide license')) {
      keywordMatches.push('Perpetual or irrevocable content license phrasing found');
    }
    if (lower.includes('location') || lower.includes('precise geolocation')) {
      keywordMatches.push('Location / geolocation collection referenced');
    }
    if (lower.includes('arbitration') || lower.includes('class action waiver')) {
      keywordMatches.push('Mandatory arbitration / dispute restriction language');
    }

    const checklistScore = selectedFlags.reduce((sum, id) => {
      const f = COMMON_CLAUSE_FLAGS.find((c) => c.id === id);
      return sum + (f ? f.weight : 0);
    }, 0);
    const combinedScore = Math.min(100, checklistScore + keywordMatches.length * 12);
    return { keywordMatches, combinedScore };
  }, [customTermsText, selectedFlags]);

  const showTool = (cat: Exclude<ToolCategory, 'all'>) => filter === 'all' || filter === cat;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <section className="space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#08090B]/10 font-mono text-[11px] uppercase tracking-[0.14em] text-[#00545F]">
          <span className="w-2 h-2 rounded-full bg-[#CDF22B]" />
          UNSEEN Intelligence Toolkit
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8">
            <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[0.95] text-[#08090B]">
              THE{' '}
              <span className="inline-block bg-[#CDF22B] text-[#08090B] px-3 py-1 rounded-2xl -rotate-1">
                UNSEEN
              </span>{' '}
              TOOLKIT.
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="font-sans text-sm sm:text-base text-[#525866] leading-relaxed">
              Five interactive instruments built to reveal invisible costs across time, study focus, group effort, permissions, and file metadata. All calculations run locally in your browser.
            </p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { id: 'all' as const, label: 'All Instruments (5)' },
            { id: 'time' as const, label: '01 Time Intelligence' },
            { id: 'student' as const, label: '02 Student Focus' },
            { id: 'group' as const, label: '03 Group Equity' },
            { id: 'privacy' as const, label: '04 Privacy & Terms' },
            { id: 'forensics' as const, label: '05 EXHAUST Scanner' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-2xl font-display text-xs font-bold transition-all cursor-pointer ${
                filter === tab.id
                  ? 'btn-tactile-lime'
                  : 'btn-tactile-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tool Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 01 TIME INTELLIGENCE */}
        {showTool('time') && (
          <article className="card-unseen p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#00545F] font-semibold">
                  01 · Time Intelligence
                </span>
                <Clock className="w-5 h-5 text-[#08090B]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#08090B]">
                Invisible Friction & Queue Simulator
              </h2>
              <p className="font-sans text-sm text-[#525866]">
                Simulate how small daily wait windows and context switches compound across a full working year.
              </p>
            </div>

            <div className="space-y-4 bg-[#FAF8F3] border border-[#08090B]/8 rounded-2xl p-4">
              <div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span>Daily Waiting / Friction (min)</span>
                  <span className="font-bold">{waitMinutes} min/day</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={60}
                  value={waitMinutes}
                  onChange={(e) => setWaitMinutes(Number(e.target.value))}
                  className="w-full accent-[#08090B] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span>Unplanned Context Switches</span>
                  <span className="font-bold">{switchesPerDay} / day</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={switchesPerDay}
                  onChange={(e) => setSwitchesPerDay(Number(e.target.value))}
                  className="w-full accent-[#08090B] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span>Active Weeks / Year</span>
                  <span className="font-bold">{weeksPerYear} weeks</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={52}
                  value={weeksPerYear}
                  onChange={(e) => setWeeksPerYear(Number(e.target.value))}
                  className="w-full accent-[#08090B] cursor-pointer"
                />
              </div>
            </div>

            <div className="card-unseen-dark p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#CDF22B] block">
                  COMPOUNDED ANNUAL LOSS
                </span>
                <span className="font-display text-3xl font-bold text-white tabular-nums">
                  {annualHours} hrs / year
                </span>
              </div>
              <div className="text-right font-mono text-xs text-[#FAF8F3]/80">
                <div>~{Math.round(annualHours / 8)} full workdays</div>
                <div className="text-[#CDF22B]">Batching switches saves ~40%</div>
              </div>
            </div>
          </article>
        )}

        {/* 02 STUDENT TIME TRACKER */}
        {showTool('student') && (
          <article className="card-unseen p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#00545F] font-semibold">
                  02 · Student Focus Matrix
                </span>
                <GraduationCap className="w-5 h-5 text-[#08090B]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#08090B]">
                Attention Leak vs. Deep Focus Ratio
              </h2>
              <p className="font-sans text-sm text-[#525866]">
                Log study blocks alongside distraction interruptions to surface how fragmented sessions affect actual retention time.
              </p>
            </div>

            <div className="space-y-2.5">
              {studyBlocks.map((block) => (
                <div
                  key={block.id}
                  className="bg-[#FAF8F3] border border-[#08090B]/8 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                >
                  <span className="font-bold text-[#08090B] truncate max-w-[160px]">
                    {block.task}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#0F766E]">{block.plannedMin}m planned</span>
                    <label className="inline-flex items-center gap-1 text-[#FF4B4B]">
                      <span>Leak:</span>
                      <input
                        type="number"
                        min={0}
                        max={block.plannedMin}
                        value={block.distractedMin}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(block.plannedMin, Number(e.target.value) || 0));
                          setStudyBlocks((prev) =>
                            prev.map((item) =>
                              item.id === block.id ? { ...item, distractedMin: v } : item
                            )
                          );
                        }}
                        className="w-12 px-1.5 py-0.5 bg-white border border-[#08090B]/15 rounded-lg text-center"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setStudyBlocks((prev) => prev.filter((item) => item.id !== block.id))
                      }
                      aria-label={`Remove ${block.task}`}
                      className="text-[#525866] hover:text-[#FF4B4B] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="Add study session (e.g. Lab Prep)..."
                  className="flex-1 bg-white border border-[#08090B]/15 rounded-xl px-3 py-2 text-xs font-sans focus:outline-none focus:border-[#08090B]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskName.trim()) return;
                    setStudyBlocks((prev) => [
                      ...prev,
                      {
                        id: `${Date.now()}`,
                        task: newTaskName.trim(),
                        plannedMin: 50,
                        distractedMin: 10,
                      },
                    ]);
                    setNewTaskName('');
                  }}
                  className="btn-tactile-secondary px-3 py-2 text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>

            <div className="bg-[#ECFFB6] border border-[#95ba07]/40 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#08090B]/70 block">
                  UNINTERRUPTED FOCUS INDEX
                </span>
                <span className="font-display text-3xl font-bold text-[#08090B] tabular-nums">
                  {focusEfficiency}%
                </span>
              </div>
              <span className="font-mono text-xs text-[#08090B] font-semibold">
                {focusEfficiency >= 80 ? 'Strong Focus Retention' : 'Batch Notifications'}
              </span>
            </div>
          </article>
        )}

        {/* 03 GROUP CONTRIBUTION ANALYZER */}
        {showTool('group') && (
          <article className="card-unseen p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#00545F] font-semibold">
                  03 · Group Contribution Equity
                </span>
                <Users className="w-5 h-5 text-[#08090B]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#08090B]">
                Workload Distribution & Visibility Check
              </h2>
              <p className="font-sans text-sm text-[#525866]">
                Compare recorded deliverables and hours across group members to catch silent workload imbalances early.
              </p>
            </div>

            <div className="space-y-2.5">
              {contributors.map((member) => {
                const share = Math.round((member.artifacts / totalArtifacts) * 100);
                return (
                  <div
                    key={member.id}
                    className="bg-[#FAF8F3] border border-[#08090B]/8 rounded-2xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-[#08090B]">{member.name}</span>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#525866]">
                          Tasks:
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={member.artifacts}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setContributors((prev) =>
                                prev.map((c) =>
                                  c.id === member.id ? { ...c, artifacts: val } : c
                                )
                              );
                            }}
                            className="ml-1 w-12 px-1 py-0.5 bg-white border border-[#08090B]/15 rounded-lg text-center"
                          />
                        </label>
                        <span className="font-bold text-[#00545F] w-10 text-right tabular-nums">
                          {share}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white border border-[#08090B]/10 overflow-hidden">
                      <div
                        className="h-full bg-[#08090B] rounded-full transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-[#FFFBEB] border border-[#F59E0B]/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[#92400E]">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <p className="font-sans leading-snug">
                <strong>Responsible Measurement Notice:</strong> Counts measure logged artifacts only and do not reflect unrecorded research, coordination, mentoring, or complexity. Use as a conversation starter—never as automated grading.
              </p>
            </div>
          </article>
        )}

        {/* 04 PRIVACY & TERMS ANALYZER */}
        {showTool('privacy') && (
          <article className="card-unseen p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#00545F] font-semibold">
                  04 · Privacy & Terms Analyzer
                </span>
                <Lock className="w-5 h-5 text-[#08090B]" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#08090B]">
                Permission & Fine-Print Surface Check
              </h2>
              <p className="font-sans text-sm text-[#525866]">
                Toggle consent clauses or paste a service excerpt to spot hidden retention, broker sharing, and license risks.
              </p>
            </div>

            <div className="space-y-2">
              {COMMON_CLAUSE_FLAGS.map((flag) => {
                const checked = selectedFlags.includes(flag.id);
                return (
                  <label
                    key={flag.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-2xl border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#FFF2F2] border-[#FF4B4B]/40 text-[#08090B]'
                        : 'bg-[#FAF8F3] border-[#08090B]/8 text-[#525866]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedFlags((prev) =>
                          prev.includes(flag.id)
                            ? prev.filter((id) => id !== flag.id)
                            : [...prev, flag.id]
                        )
                      }
                      className="mt-0.5 accent-[#FF4B4B]"
                    />
                    <span className="font-sans leading-snug">{flag.label}</span>
                  </label>
                );
              })}

              <textarea
                rows={2}
                value={customTermsText}
                onChange={(e) => setCustomTermsText(e.target.value)}
                placeholder="Paste terms snippet (e.g. 'we share with third party affiliates and retain perpetual license')..."
                className="w-full bg-[#FAF8F3] border border-[#08090B]/15 rounded-2xl p-3 font-sans text-xs focus:outline-none focus:border-[#08090B]"
              />
            </div>

            <div className="space-y-2">
              <div
                className={`rounded-2xl p-3.5 border flex items-center justify-between ${
                  termsAnalysis.combinedScore >= 55
                    ? 'bg-[#FFE5E5] border-[#FF4B4B]/45 text-[#B91C1C]'
                    : 'bg-[#F0FDFA] border-[#00545F]/30 text-[#00545F]'
                }`}
              >
                <span className="font-mono text-xs font-bold uppercase flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Privacy Friction Score
                </span>
                <span className="font-display text-2xl font-bold tabular-nums">
                  {termsAnalysis.combinedScore}/100
                </span>
              </div>
              {termsAnalysis.keywordMatches.length > 0 && (
                <ul className="space-y-1 font-mono text-[11px] text-[#B91C1C] px-1">
                  {termsAnalysis.keywordMatches.map((m) => (
                    <li key={m} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        )}

        {/* 05 EXHAUST FILE & METADATA FORENSICS */}
        {showTool('forensics') && (
          <article className="card-unseen-dark lg:col-span-2 p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CDF22B]/15 border border-[#CDF22B]/35 font-mono text-[11px] text-[#CDF22B]">
                <FileSearch className="w-3.5 h-3.5" />
                05 · EXHAUST — THE FORENSIC MIRROR
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
                Inspect Image EXIF, PDF Metadata & Writing Patterns Locally
              </h2>
              <p className="font-sans text-sm text-[#FAF8F3]/80 leading-relaxed">
                Launch the flagship EXHAUST Workstation to expose embedded GPS coordinates, camera serials, PDF author history, or writing formatting patterns—then scrub and verify output in one click on your device.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onLaunchScanner('gps')}
                className="btn-tactile-lime px-5 py-3 text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Scan Sample Photo (GPS)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onLaunchScanner('pdf')}
                className="px-4 py-3 rounded-2xl border border-white/25 text-white hover:border-[#CDF22B] hover:text-[#CDF22B] font-display text-sm font-semibold cursor-pointer"
              >
                Scan Sample PDF
              </button>
              <button
                type="button"
                onClick={() => onLaunchScanner('text')}
                className="px-4 py-3 rounded-2xl border border-white/25 text-white hover:border-[#CDF22B] hover:text-[#CDF22B] font-display text-sm font-semibold cursor-pointer"
              >
                Open Text Pattern Lab
              </button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
