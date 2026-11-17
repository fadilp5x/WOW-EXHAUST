import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Shield } from 'lucide-react';
import { TypewriterEngine, type TypewriterLine } from './TypewriterEngine';

const CONFESSION_LINES: TypewriterLine[] = [
  { text: 'Every day, millions of photographs are shared.', pauseAfterMs: 550 },
  { text: 'Some carry locations their owners have never seen.', pauseAfterMs: 600 },
  { text: 'Some documents reveal authors, software, and hidden properties.', pauseAfterMs: 600 },
  { text: 'Even ordinary writing carries patterns.', pauseAfterMs: 550 },
  { text: 'None of this is obvious when you press Share.', pauseAfterMs: 600 },
  { text: 'But the data can travel with the file.', pauseAfterMs: 600 },
  { text: 'Today, we built the mirror.', pauseAfterMs: 700 },
  { text: 'EXHAUST', variant: 'brand', pauseAfterMs: 650 },
  { text: 'THE FORENSIC MIRROR FOR YOUR DIGITAL GHOST.', variant: 'subtitle', pauseAfterMs: 650 },
  {
    text: 'Your original files stay on your device. Saved report summaries expire after two hours.',
    variant: 'notice',
    pauseAfterMs: 350,
  },
];

interface ActOneConfessionProps {
  onLaunch: () => void;
  onSkipToMachine: () => void;
}

export function ActOneConfession({
  onLaunch,
  onSkipToMachine,
}: ActOneConfessionProps) {
  const [readyToLaunch, setReadyToLaunch] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const shieldRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const launchedRef = useRef(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const triggerLaunch = useCallback(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;

    try {
      sessionStorage.setItem('exhaust_intro_viewed', '1');
    } catch {
      // Ignore storage failures
    }

    if (reducedMotion || !containerRef.current || !shieldRef.current) {
      onLaunch();
      return;
    }

    setTransitioning(true);

    const tl = gsap.timeline({
      onComplete: () => {
        onLaunch();
      },
    });

    tl.to('.confession-stage', { opacity: 0, duration: 0.14, ease: 'power2.out' })
      .fromTo(
        shieldRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.16, ease: 'power3.out' }
      )
      .to(shieldRef.current, {
        x: -6,
        skewX: 6,
        filter: 'drop-shadow(3px 0 0 #FF2A2A) drop-shadow(-3px 0 0 #00FF41)',
        duration: 0.06,
      })
      .to(shieldRef.current, {
        x: 5,
        skewX: -4,
        duration: 0.05,
      })
      .to(shieldRef.current, {
        x: 0,
        skewX: 0,
        opacity: 0,
        duration: 0.08,
      })
      .to(containerRef.current, { backgroundColor: '#000000', duration: 0.06 });
  }, [onLaunch, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Tab') return;
      triggerLaunch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerLaunch]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center select-none overflow-hidden"
      onClick={() => {
        if (readyToLaunch) triggerLaunch();
      }}
    >
      {/* Main pure-black confession stage */}
      <div className="confession-stage flex flex-col items-center justify-center w-full px-4">
        <TypewriterEngine
          lines={CONFESSION_LINES}
          charDelayMs={24}
          reducedMotion={reducedMotion}
          onComplete={() => setReadyToLaunch(true)}
        />

        <div className="mt-12 min-h-[3.5rem] flex flex-col items-center justify-center gap-3">
          {readyToLaunch && !transitioning && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerLaunch();
              }}
              className="px-6 py-3 font-mono text-xs sm:text-sm tracking-[0.22em] text-[#C7FF00] border border-[#C7FF00]/40 bg-[#07130D]/80 hover:bg-[#0B1D13] transition-colors animate-pulse focus-visible:outline-2 focus-visible:outline-[#C7FF00] cursor-pointer"
            >
              <span className="hidden sm:inline">PRESS ANY KEY TO LAUNCH</span>
              <span className="sm:hidden">TAP TO LAUNCH</span>
            </button>
          )}
        </div>
      </div>

      {/* Brief EXHAUST shield during film-cut launch */}
      <div
        ref={shieldRef}
        className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-0"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-16 h-16 text-[#00FF41]" strokeWidth={1.5} />
          <span className="font-display text-4xl tracking-[0.22em] text-[#D7FFE0]">
            EXHAUST
          </span>
        </div>
      </div>

      {/* Bottom-right Skip Intro */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerLaunch();
          }}
          className="font-mono text-xs tracking-wider text-neutral-400 hover:text-white underline underline-offset-4 px-3 py-2 focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
        >
          Skip Intro
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            try {
              sessionStorage.setItem('exhaust_intro_viewed', '1');
            } catch {
              // ignore
            }
            onSkipToMachine();
          }}
          className="font-mono text-xs tracking-wider text-[#7FB98A] hover:text-[#C7FF00] px-3 py-2 focus-visible:outline-2 focus-visible:outline-[#C7FF00] cursor-pointer"
        >
          Enter Machine
        </button>
      </div>
    </div>
  );
}
