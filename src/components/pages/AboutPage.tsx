import { ArrowRight, ShieldCheck } from 'lucide-react';
import heroSculpture from '../../assets/images/unseen_hero_sculpture_1794933786049.jpg';

interface AboutPageProps {
  onOpenScanner?: () => void;
}

const BELIEFS = [
  {
    num: '01',
    title: 'Local-First Forensics',
    text: 'EXIF parsing, PDF inspection, text pattern scoring, and pixel redaction happen right inside your browser memory.',
  },
  {
    num: '02',
    title: 'Honest Technical Boundaries',
    text: 'We never claim writing-pattern indexes detect AI or prove authorship, and we disclose every scrubbing limitation.',
  },
  {
    num: '03',
    title: 'Explicit Consent for External AI',
    text: 'Gemini explanations and visual privacy inspection are strictly opt-in, clearly disclosed, and never send raw GPS or full uploads silently.',
  },
  {
    num: '04',
    title: 'Verifiable Proof of Cleaning',
    text: 'After scrubbing a file, EXHAUST re-runs the local parser on the cleaned output so you verify the score drop yourself.',
  },
  {
    num: '05',
    title: 'Ephemeral 2-Hour Archives',
    text: 'Even minimized report summaries saved to MongoDB Atlas carry an automatic 7,200-second TTL expiration.',
  },
];

export function AboutPage({ onOpenScanner }: AboutPageProps) {
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-20">
      {/* Centered Manifesto Hero matching exact UNSEEN visual reference */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#08090B] text-[#CDF22B] font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
          THE UNSEEN MANIFESTO
        </span>

        <h1 className="font-display text-5xl sm:text-7xl font-bold leading-[0.94] text-[#08090B]">
          Not everything lost{' '}
          <span className="inline-block bg-[#08090B] text-[#CDF22B] px-4 py-1.5 rounded-2xl shadow-[0_4px_0_#000] -rotate-1 mt-1">
            is visible.
          </span>
        </h1>

        <p className="font-sans text-base sm:text-lg text-[#525866] leading-relaxed max-w-xl mx-auto">
          UNSEEN was created to reveal the invisible losses that influence our everyday lives. We believe that understanding what goes unnoticed is the first step towards meaningful change.
        </p>
      </section>

      {/* 01 // THE GENESIS — Our Story + Architectural Visual */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-4">
          <span className="font-mono text-xs font-bold text-[#00545F] tracking-[0.14em] uppercase">
            01 // THE GENESIS
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#08090B]">
            Our Story
          </h2>
          <p className="font-sans text-sm sm:text-base text-[#525866] leading-relaxed">
            Modern life is filled with high-resolution dashboards for finance and fitness, yet we remain blind to hidden metadata riding inside everyday photographs, exported PDFs, and consented terms.
          </p>
          <p className="font-sans text-sm sm:text-base text-[#525866] leading-relaxed">
            Project WOW Unseen created EXHAUST so students, researchers, and everyday creators can see what their own files reveal—locally, before sharing.
          </p>
        </div>

        <div className="lg:col-span-6">
          <div className="card-unseen overflow-hidden p-3">
            <img
              src={heroSculpture}
              alt="Sculptural dark ribbon surrounding a luminous lime and teal sphere on warm ivory"
              className="w-full aspect-video object-cover rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* 02 Mission & 03 Vision */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="card-unseen p-7 space-y-3">
          <span className="font-mono text-xs font-bold text-[#00545F]">02 // OUR MISSION</span>
          <h2 className="font-display text-2xl font-bold text-[#08090B]">Make Privacy Concrete</h2>
          <p className="font-sans text-sm text-[#525866] leading-relaxed">
            Translate technical EXIF tags, PDF dictionaries, and hidden text formatting into calm, honest explanations paired with immediate one-click local remediation.
          </p>
        </article>

        <article className="card-unseen p-7 space-y-3">
          <span className="font-mono text-xs font-bold text-[#00545F]">03 // OUR VISION</span>
          <h2 className="font-display text-2xl font-bold text-[#08090B]">Zero-Knowledge Default</h2>
          <p className="font-sans text-sm text-[#525866] leading-relaxed">
            A sharing culture where inspecting metadata and removing unnecessary identifiers is as routine and effortless as checking spelling.
          </p>
        </article>
      </section>

      {/* 04 What We Believe */}
      <section className="space-y-6">
        <div className="space-y-1">
          <span className="font-mono text-xs font-bold text-[#00545F] uppercase tracking-[0.14em]">
            04 // WHAT WE BELIEVE
          </span>
          <h2 className="font-display text-3xl font-bold text-[#08090B]">
            Five Non-Negotiable Engineering Commitments
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BELIEFS.map((b) => (
            <div key={b.num} className="card-unseen p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#00545F]">{b.num}</span>
                <ShieldCheck className="w-4 h-4 text-[#12A36B]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#08090B]">{b.title}</h3>
              <p className="font-sans text-xs text-[#525866] leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 05 Approach CTA */}
      <section className="card-unseen-dark p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="font-mono text-[10px] text-[#CDF22B] tracking-widest uppercase font-bold">
            05 // OUR APPROACH
          </span>
          <h2 className="font-display text-3xl font-bold text-white">
            Collect · Analyse · Reveal · Clean
          </h2>
          <p className="font-sans text-sm text-[#FAF8F3]/75 max-w-xl">
            Every forensic scan executes inside your browser with verified before-and-after checks.
          </p>
        </div>
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="btn-tactile-lime px-6 py-3.5 text-sm inline-flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Open Live Scanner</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </section>
    </main>
  );
}
