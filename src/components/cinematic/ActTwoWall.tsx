import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Shield,
  SkipForward,
} from 'lucide-react';

interface SceneDefinition {
  id: number;
  code: string;
  imageSrc: string;
  imageAlt: string;
  headline: string[];
  supporting: string;
  accentVariant: 'signal' | 'teal' | 'danger';
  transitionType: 'shutter' | 'glitch' | 'flash';
}

const SCENES: SceneDefinition[] = [
  {
    id: 0,
    code: 'SCENE 01 · THE CAPTURE',
    imageSrc: '/assets/aistudio/image_da759b11.png',
    imageAlt: 'University-age adult taking a smartphone photo on a city street at night',
    headline: ['ONE PHOTO.', 'A THOUSAND INVISIBLE DETAILS.'],
    supporting: 'What you capture is only part of what you share.',
    accentVariant: 'signal',
    transitionType: 'shutter',
  },
  {
    id: 1,
    code: 'SCENE 02 · THE INVESTIGATION',
    imageSrc: '/assets/aistudio/image_3d616a7b.png',
    imageAlt: 'Investigator seated before multiple forensic monitors analyzing photo metadata and map',
    headline: ['THE IMAGE IS NOT', 'THE WHOLE FILE.'],
    supporting: 'Metadata can reveal what the photograph never shows.',
    accentVariant: 'teal',
    transitionType: 'glitch',
  },
  {
    id: 2,
    code: 'SCENE 03 · THE REVEAL',
    imageSrc: '/assets/aistudio/image_5f161e95.png',
    imageAlt: 'Suspended cord framing a stark privacy warning in low-key red and dark green lighting',
    headline: ['YOUR IMAGE KNOWS TOO MUCH.'],
    supporting: 'Discover the hidden data. Understand the exposure. Take control.',
    accentVariant: 'danger',
    transitionType: 'flash',
  },
];

function ScrambleHeadline({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/%';

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(text);
      return;
    }

    let frame = 0;
    const totalFrames = 18;
    const interval = window.setInterval(() => {
      frame += 1;
      const revealedCount = Math.floor((frame / totalFrames) * text.length);
      const next = text
        .split('')
        .map((ch, idx) => {
          if (ch === ' ' || ch === '.') return ch;
          if (idx < revealedCount) return ch;
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');
      setDisplay(next);
      if (frame >= totalFrames) {
        setDisplay(text);
        window.clearInterval(interval);
      }
    }, 32);

    return () => window.clearInterval(interval);
  }, [text]);

  return <span>{display}</span>;
}

interface ActTwoWallProps {
  onStartXray: () => void;
  onLoadSample: (sample: 'gps' | 'pdf' | 'text') => void;
  onReplayIntro: () => void;
}

export function ActTwoWall({
  onStartXray,
  onLoadSample,
  onReplayIntro,
}: ActTwoWallProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [cutMode, setCutMode] = useState<'none' | 'shutter' | 'glitch' | 'flash'>('none');
  const stageImageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const transitionToScene = useCallback(
    (nextIndex: number) => {
      const normalized = ((nextIndex % SCENES.length) + SCENES.length) % SCENES.length;
      const currentTransition = SCENES[sceneIndex]?.transitionType ?? 'shutter';

      if (reducedMotion) {
        setSceneIndex(normalized);
        return;
      }

      setCutMode(currentTransition);
      window.setTimeout(() => {
        setSceneIndex(normalized);
      }, 110);
      window.setTimeout(() => {
        setCutMode('none');
      }, 280);
    },
    [reducedMotion, sceneIndex]
  );

  // Auto-advance every ~4 seconds while playing & tab visible
  useEffect(() => {
    if (!isPlaying) return;

    let timer: number | null = null;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          transitionToScene(sceneIndex + 1);
        }
      }, 4200);
    };
    schedule();

    const onVisibility = () => {
      if (document.hidden && timer !== null) {
        window.clearTimeout(timer);
      } else if (!document.hidden && timer === null) {
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isPlaying, sceneIndex, transitionToScene]);

  // GSAP scene camera push-in / pan & caption animation
  useEffect(() => {
    if (reducedMotion || !stageImageRef.current || !captionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        stageImageRef.current,
        { scale: sceneIndex === 1 ? 1.05 : 1.0, x: sceneIndex === 1 ? -10 : 0 },
        {
          scale: sceneIndex === 1 ? 1.09 : 1.06,
          x: sceneIndex === 1 ? 10 : 0,
          duration: 4.1,
          ease: 'sine.out',
        }
      );

      gsap.fromTo(
        captionRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
      );
    });

    return () => ctx.revert();
  }, [reducedMotion, sceneIndex]);

  const activeScene = SCENES[sceneIndex];

  return (
    <div className="min-h-screen bg-[#020604] text-[#D7FFE0] flex flex-col">
      {/* Top-Left Watermark + Top Bar Contract */}
      <header className="relative z-30 flex items-center justify-between gap-6 px-4 sm:px-8 py-3.5 border-b border-[#0B3D1E] bg-[#020604]/90 backdrop-blur-sm">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#7FB98A] uppercase truncate">
            AN INITIATIVE BY PROJECT WOW UNSEEN
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <Shield className="w-4 h-4 text-[#C7FF00] shrink-0" />
            <span className="font-display text-2xl tracking-[0.14em] text-[#D7FFE0] whitespace-nowrap">
              EXHAUST
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-[#7FB98A]">
          <button
            type="button"
            onClick={() => transitionToScene(0)}
            className={`whitespace-nowrap shrink-0 hover:text-[#D7FFE0] transition-colors cursor-pointer ${sceneIndex === 0 ? 'text-[#C7FF00]' : ''}`}
          >
            01. Capture
          </button>
          <button
            type="button"
            onClick={() => transitionToScene(1)}
            className={`whitespace-nowrap shrink-0 hover:text-[#D7FFE0] transition-colors cursor-pointer ${sceneIndex === 1 ? 'text-[#C7FF00]' : ''}`}
          >
            02. Investigation
          </button>
          <button
            type="button"
            onClick={() => transitionToScene(2)}
            className={`whitespace-nowrap shrink-0 hover:text-[#D7FFE0] transition-colors cursor-pointer ${sceneIndex === 2 ? 'text-[#FF2A2A]' : ''}`}
          >
            03. Reveal
          </button>
          <button
            type="button"
            onClick={onReplayIntro}
            className="whitespace-nowrap shrink-0 hover:text-[#D7FFE0] transition-colors cursor-pointer"
          >
            Replay Intro
          </button>
        </nav>

        <button
          type="button"
          onClick={onStartXray}
          className="px-4 py-2 bg-[#C7FF00] text-[#021E18] font-mono text-xs font-bold tracking-wider hover:bg-[#d8ff4d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          ENTER THE MACHINE
        </button>
      </header>

      {/* Main 3-Scene Cinematic Wall Stage */}
      <main className="relative flex-1 flex flex-col">
        <section className="relative w-full min-h-[76vh] lg:min-h-[80vh] overflow-hidden bg-black flex items-end">
          {/* Scene Image Layer + Glitch Layer */}
          <div ref={stageImageRef} className="absolute inset-0 will-change-transform">
            <img
              src={activeScene.imageSrc}
              alt={activeScene.imageAlt}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover ${
                sceneIndex === 0
                  ? 'object-[70%_35%] md:object-center'
                  : sceneIndex === 1
                    ? 'object-[55%_45%] md:object-center'
                    : 'object-center'
              }`}
            />
          </div>

          {/* Horizontal-band glitch slice overlay during cut */}
          {cutMode === 'glitch' && (
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                backgroundImage: `url(${activeScene.imageSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                clipPath: 'inset(32% 0 46% 0)',
                transform: 'translateX(14px)',
                filter: 'hue-rotate(90deg) contrast(1.4)',
              }}
            />
          )}

          {/* Shutter black cut or flash */}
          {cutMode === 'shutter' && (
            <div className="absolute inset-0 bg-black z-20 pointer-events-none transition-opacity duration-100" />
          )}
          {cutMode === 'flash' && (
            <div className="absolute inset-0 bg-[#FF2A2A]/35 z-20 pointer-events-none" />
          )}

          {/* Scene-specific non-intrusive visual telemetry overlays */}
          {sceneIndex === 0 && (
            <div
              className="hidden sm:block absolute top-[22%] right-[25%] w-24 h-24 border border-[#C7FF00]/60 pointer-events-none z-10"
              aria-hidden="true"
            >
              <div className="w-2 h-2 border-t-2 border-l-2 border-[#C7FF00] -m-0.5" />
              <span className="absolute -bottom-5 left-0 font-mono text-[10px] text-[#C7FF00]">
                EXIF STREAM READY
              </span>
            </div>
          )}

          {sceneIndex === 1 && (
            <div
              className="absolute inset-x-0 top-0 h-0.5 bg-[#00FF41]/70 shadow-[0_0_12px_#00FF41] animate-pulse pointer-events-none z-10"
              aria-hidden="true"
            />
          )}

          {/* Atmospheric scrims + subtle film grain & scanlines */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020604] via-[#020604]/55 to-black/30 pointer-events-none z-10" />
          <div className="absolute inset-0 exhaust-scanlines z-10" aria-hidden="true" />
          <div className="absolute inset-0 exhaust-grain z-10" aria-hidden="true" />

          {/* Editable HTML Scene Caption + Primary Action */}
          <div
            ref={captionRef}
            className="relative z-20 w-full max-w-7xl mx-auto px-5 sm:px-10 pb-10 pt-20 flex flex-col lg:flex-row lg:items-end justify-between gap-8"
          >
            <div className="max-w-3xl">
              <p className="font-mono text-xs tracking-[0.2em] text-[#7FB98A] mb-2">
                {activeScene.code}
              </p>

              <h1
                className={`font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.94] tracking-wide ${
                  activeScene.accentVariant === 'danger'
                    ? 'text-[#FF2A2A] drop-shadow-[0_2px_18px_rgba(255,42,42,0.35)]'
                    : 'text-[#D7FFE0]'
                }`}
              >
                {activeScene.headline.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h1>

              <p className="mt-3 font-sans text-base sm:text-lg text-[#D7FFE0]/90 max-w-xl">
                {activeScene.supporting}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onStartXray}
                  className="px-6 py-3 bg-[#C7FF00] text-[#021E18] font-mono text-sm font-bold tracking-wider hover:bg-[#d8ff4d] transition-colors cursor-pointer"
                >
                  START THE X-RAY
                </button>
                <button
                  type="button"
                  onClick={onStartXray}
                  className="px-5 py-3 border border-[#7FB98A]/40 bg-[#07130D]/80 text-[#D7FFE0] font-mono text-xs tracking-wider hover:border-[#C7FF00] transition-colors cursor-pointer"
                >
                  ENTER THE MACHINE
                </button>
              </div>
            </div>

            {/* Scene Director Controls */}
            <div className="flex flex-col items-start lg:items-end gap-3">
              <div className="flex items-center gap-1.5 bg-[#07130D]/90 border border-[#0B3D1E] p-1">
                <button
                  type="button"
                  aria-label="Previous scene"
                  onClick={() => transitionToScene(sceneIndex - 1)}
                  className="p-2 text-[#7FB98A] hover:text-[#D7FFE0] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause cinematic sequence' : 'Play cinematic sequence'}
                  onClick={() => setIsPlaying((p) => !p)}
                  className="p-2 text-[#C7FF00] hover:text-white cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  aria-label="Next scene"
                  onClick={() => transitionToScene(sceneIndex + 1)}
                  className="p-2 text-[#7FB98A] hover:text-[#D7FFE0] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Replay wall from scene 1"
                  onClick={() => {
                    setIsPlaying(true);
                    transitionToScene(0);
                  }}
                  className="p-2 text-[#7FB98A] hover:text-[#D7FFE0] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onStartXray}
                  className="px-2.5 py-1.5 font-mono text-[11px] text-[#7FB98A] hover:text-[#C7FF00] flex items-center gap-1 cursor-pointer"
                >
                  <span>SKIP</span>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scene Progress Indicators */}
              <div className="flex items-center gap-2" role="tablist" aria-label="Scene selector">
                {SCENES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={sceneIndex === idx}
                    aria-label={`View ${s.code}`}
                    onClick={() => transitionToScene(idx)}
                    className={`h-1.5 transition-all cursor-pointer ${
                      sceneIndex === idx
                        ? idx === 2
                          ? 'w-12 bg-[#FF2A2A]'
                          : 'w-12 bg-[#C7FF00]'
                        : 'w-6 bg-[#0B3D1E] hover:bg-[#7FB98A]'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Below-the-fold Scramble Headline + Quick Sample Launch Strip */}
        <section className="border-t border-[#0B3D1E] bg-[#07130D] px-5 sm:px-10 py-8">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl sm:text-5xl tracking-wide text-[#D7FFE0]">
                <ScrambleHeadline text="YOUR FILE IS TELLING ON YOU." />
              </h2>
              <p className="mt-1 font-sans text-sm text-[#7FB98A] max-w-2xl">
                Drop a photo, inspect a document, or analyze your writing. See what it reveals. Then take control.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="font-mono text-[11px] text-[#7FB98A] mr-1 whitespace-nowrap">
                QUICK SAMPLES:
              </span>
              <button
                type="button"
                onClick={() => onLoadSample('gps')}
                className="px-3 py-2 border border-[#0B3D1E] bg-[#0B1D13] hover:border-[#C7FF00] text-xs font-mono text-[#D7FFE0] transition-colors cursor-pointer whitespace-nowrap"
              >
                SAMPLE: Phone Photo
              </button>
              <button
                type="button"
                onClick={() => onLoadSample('pdf')}
                className="px-3 py-2 border border-[#0B3D1E] bg-[#0B1D13] hover:border-[#C7FF00] text-xs font-mono text-[#D7FFE0] transition-colors cursor-pointer whitespace-nowrap"
              >
                SAMPLE: Resume PDF
              </button>
              <button
                type="button"
                onClick={() => onLoadSample('text')}
                className="px-3 py-2 border border-[#0B3D1E] bg-[#0B1D13] hover:border-[#C7FF00] text-xs font-mono text-[#D7FFE0] transition-colors cursor-pointer whitespace-nowrap"
              >
                SAMPLE: Text Post
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
