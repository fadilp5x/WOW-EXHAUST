import { ArrowRight, Clock, Eye, Lock, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import impactVisual from '../../assets/images/unseen_impact_editorial_1794933787784.jpg';

interface ImpactPageProps {
  onOpenScanner: () => void;
  onReplayIntro: () => void;
}

const IMPACT_PILLARS = [
  {
    num: '01',
    title: 'Time Awareness',
    icon: Clock,
    blindspot: 'Micro-delays, repetitive tool switching, and unmeasured waiting silently erode focus across semesters and workweeks.',
    shift: 'Making queue time and transition overhead measurable turns abstract frustration into actionable schedule fixes.',
  },
  {
    num: '02',
    title: 'Student Productivity',
    icon: Eye,
    blindspot: 'Studying for hours while fragmented by pings hides how little continuous deep-work time actually happened.',
    shift: 'Separating planned blocks from attention leaks empowers students to reclaim true rest and retention.',
  },
  {
    num: '03',
    title: 'Collaborative Equity',
    icon: Users,
    blindspot: 'Silent scope creep and uneven task loads go unaddressed until team burnout hits before deadlines.',
    shift: 'Transparent artifact visibility prompts healthier team check-ins without relying on guesswork.',
  },
  {
    num: '04',
    title: 'Digital Privacy Awareness',
    icon: Lock,
    blindspot: 'Sharing a single raw photo or PDF can unknowingly expose home GPS coordinates, hardware serials, and editor history.',
    shift: 'Inspecting files on your own device reveals exactly what bystanders and scrapers can read—before upload.',
  },
  {
    num: '05',
    title: 'Verified Information Protection',
    icon: ShieldCheck,
    blindspot: 'Users assume "Delete" or social uploads automatically sanitize metadata, or trust unverified promises.',
    shift: 'Before-and-after verification re-parses the cleaned file on device so protection is observable, not guessed.',
  },
];

export function ImpactPage({ onOpenScanner, onReplayIntro }: ImpactPageProps) {
  return (
    <main>
      {/* Dramatic Midnight Black Editorial Band */}
      <section className="bg-[#08090B] text-[#FAF8F3] py-14 sm:py-20 px-4 sm:px-6 border-b border-white/10">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CDF22B]/15 border border-[#CDF22B]/35 font-mono text-[11px] uppercase tracking-[0.16em] text-[#CDF22B]">
              Project WOW Unseen · Why Visibility Matters
            </span>

            <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[0.95] text-white">
              Small invisible losses.{' '}
              <span className="inline-block bg-[#CDF22B] text-[#08090B] px-3 py-1 rounded-2xl -rotate-1">
                Bigger consequences.
              </span>
            </h1>

            <p className="font-sans text-base sm:text-lg text-[#FAF8F3]/80 leading-relaxed max-w-2xl">
              Every photo, exported PDF, and consented click carries quiet metadata trails. Across millions of everyday files, those tiny unexamined leaks become persistent location trails, hardware fingerprints, and privacy exposure.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenScanner}
                className="btn-tactile-lime px-6 py-3.5 text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Test Your Own File Locally</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onReplayIntro}
                className="px-5 py-3.5 rounded-2xl border border-white/25 text-white hover:border-[#CDF22B] hover:text-[#CDF22B] font-display text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Replay 3-Act Confession</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl overflow-hidden border border-[#CDF22B]/25 bg-[#121519] shadow-2xl">
              <img
                src={impactVisual}
                alt="Optical prism refracting a lime beam across obsidian and limestone surfaces"
                className="w-full aspect-video object-cover"
              />
              <div className="p-4 flex items-center justify-between font-mono text-[11px] text-[#FAF8F3]/75">
                <span>LOCAL INSPECTION ONLY</span>
                <span className="text-[#CDF22B]">ZERO FABRICATED METRICS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Soft Ivory Five Pillars Breakdown */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-14 space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#00545F] font-semibold">
            Five Domains of Invisible Leakage
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#08090B]">
            Where Unseen Data Quietly Compounds
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {IMPACT_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.num}
                className="card-unseen p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#00545F]">
                      {pillar.num}
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-[#ECFFB6] flex items-center justify-center text-[#08090B]">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#08090B]">
                    {pillar.title}
                  </h3>
                  <div className="bg-[#FAF8F3] border border-[#08090B]/8 rounded-2xl p-3 space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#FF4B4B] font-bold block">
                      What Stays Hidden
                    </span>
                    <p className="font-sans text-xs text-[#525866] leading-relaxed">
                      {pillar.blindspot}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F0FDFA] border border-[#00545F]/20 rounded-2xl p-3 space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#00545F] font-bold block">
                    What Visibility Changes
                  </span>
                  <p className="font-sans text-xs text-[#08090B] leading-relaxed">
                    {pillar.shift}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Closing Directive */}
        <div className="card-unseen-dark p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Visibility is the first step towards change.
            </h2>
            <p className="font-sans text-sm text-[#FAF8F3]/75">
              Every scan in EXHAUST runs directly on your device—no raw uploads, no hidden tracking, verifiable proof.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenScanner}
            className="btn-tactile-lime px-6 py-3.5 text-sm inline-flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Launch Forensic Mirror</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>
  );
}
