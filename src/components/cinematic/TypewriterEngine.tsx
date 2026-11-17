import { useEffect, useRef, useState } from 'react';

export interface TypewriterLine {
  text: string;
  pauseAfterMs?: number;
  variant?: 'default' | 'brand' | 'subtitle' | 'notice';
}

interface TypewriterEngineProps {
  lines: TypewriterLine[];
  charDelayMs?: number;
  onComplete?: () => void;
  reducedMotion?: boolean;
}

export function TypewriterEngine({
  lines,
  charDelayMs = 28,
  onComplete,
  reducedMotion = false,
}: TypewriterEngineProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<number | null>(null);
  const completedCalledRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setLineIndex(lines.length - 1);
      setCharIndex(lines[lines.length - 1]?.text.length ?? 0);
      setFinished(true);
      if (!completedCalledRef.current) {
        completedCalledRef.current = true;
        onComplete?.();
      }
      return;
    }

    if (finished) return;

    const current = lines[lineIndex];
    if (!current) {
      setFinished(true);
      if (!completedCalledRef.current) {
        completedCalledRef.current = true;
        onComplete?.();
      }
      return;
    }

    if (charIndex < current.text.length) {
      timerRef.current = window.setTimeout(() => {
        setCharIndex((c) => c + 1);
      }, charDelayMs);
    } else {
      const pause = current.pauseAfterMs ?? 550;
      timerRef.current = window.setTimeout(() => {
        if (lineIndex + 1 < lines.length) {
          setLineIndex((i) => i + 1);
          setCharIndex(0);
        } else {
          setFinished(true);
          if (!completedCalledRef.current) {
            completedCalledRef.current = true;
            onComplete?.();
          }
        }
      }, pause);
    }

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [charDelayMs, charIndex, finished, lineIndex, lines, onComplete, reducedMotion]);

  const currentLine = lines[lineIndex];
  const visibleText = currentLine ? currentLine.text.slice(0, charIndex) : '';

  return (
    <div className="relative w-full max-w-3xl px-6 text-center">
      {/* Accessible full narrative for screen readers */}
      <div className="sr-only">
        {lines.map((l, idx) => (
          <p key={idx}>{l.text}</p>
        ))}
      </div>

      {/* Previously rendered subtle trail (last 2 lines) */}
      <div className="mb-5 space-y-2 min-h-[3.5rem]" aria-hidden="true">
        {lines.slice(Math.max(0, lineIndex - 2), lineIndex).map((line, idx) => (
          <p
            key={`${lineIndex}-${idx}`}
            className={
              line.variant === 'brand'
                ? 'font-display text-3xl tracking-widest text-[#C7FF00]/45'
                : 'font-mono text-xs sm:text-sm text-[#7FB98A]/45'
            }
          >
            {line.text}
          </p>
        ))}
      </div>

      {/* Active line */}
      <div className="min-h-[5rem] flex items-center justify-center" aria-live="polite">
        <p
          className={
            currentLine?.variant === 'brand'
              ? 'font-display text-6xl sm:text-8xl tracking-[0.12em] text-[#C7FF00]'
              : currentLine?.variant === 'subtitle'
                ? 'font-display text-2xl sm:text-4xl tracking-[0.08em] text-[#D7FFE0]'
                : currentLine?.variant === 'notice'
                  ? 'font-mono text-xs sm:text-sm text-[#7FB98A] max-w-xl leading-relaxed'
                  : 'font-mono text-base sm:text-xl text-[#D7FFE0] leading-relaxed'
          }
        >
          <span>{visibleText}</span>
          <span
            className="inline-block w-[0.55em] h-[1.05em] ml-1 align-middle bg-white animate-pulse"
            aria-hidden="true"
          />
        </p>
      </div>
    </div>
  );
}
