'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatClock } from '@/lib/exam-shared';
import {
  ceilingMinutesLeft,
  examCountdownDisplayClasses,
  getExamCountdownVisualTier,
  shouldPulseOnMinuteTransition,
} from '@/lib/exam/countdown-visual';

interface ExamCountdownTimerProps {
  secondsLeft: number;
  className?: string;
}

const PULSE_MS = 1800;

/**
 * Üst-merkez sınav sayacı — ses yok; renk kademesi + dakika eşiği pulse.
 */
export function ExamCountdownTimer({
  secondsLeft,
  className = '',
}: ExamCountdownTimerProps): ReactNode {
  const [pulsing, setPulsing] = useState(false);
  const prevMinutesRef = useRef<number | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = getExamCountdownVisualTier(secondsLeft);
  const display = formatClock(Math.max(0, secondsLeft));

  useEffect(() => {
    const minutes = ceilingMinutesLeft(secondsLeft);
    const prev = prevMinutesRef.current;

    if (shouldPulseOnMinuteTransition(prev, minutes)) {
      setPulsing(true);
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
      pulseTimeoutRef.current = setTimeout(() => {
        setPulsing(false);
        pulseTimeoutRef.current = null;
      }, PULSE_MS);
    }

    prevMinutesRef.current = minutes;

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, [secondsLeft]);

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Kalan süre ${display}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Kalan süre
      </span>
      <span className={examCountdownDisplayClasses(tier, pulsing)}>
        {display}
      </span>
    </div>
  );
}
