/** Sınav sayacı görsel kademeleri (ses yok). */
export type ExamCountdownVisualTier = 'calm' | 'amber' | 'critical';

export const EXAM_COUNTDOWN_MINUTE_PULSE_MARKS = [
  10, 5, 4, 3, 2, 1,
] as const;

export function getExamCountdownVisualTier(
  secondsLeft: number,
): ExamCountdownVisualTier {
  if (secondsLeft <= 300) return 'critical';
  if (secondsLeft <= 600) return 'amber';
  return 'calm';
}

/** Dakika tavanı (kalan süre); eşik geçişlerinde pulse için. */
export function ceilingMinutesLeft(secondsLeft: number): number {
  if (secondsLeft <= 0) return 0;
  return Math.ceil(secondsLeft / 60);
}

export function shouldPulseOnMinuteTransition(
  previousMinutes: number | null,
  nextMinutes: number,
): boolean {
  if (previousMinutes === null || previousMinutes === nextMinutes) {
    return false;
  }
  return (EXAM_COUNTDOWN_MINUTE_PULSE_MARKS as readonly number[]).includes(
    nextMinutes,
  );
}

export function examCountdownDisplayClasses(
  tier: ExamCountdownVisualTier,
  pulsing: boolean,
): string {
  const size =
    'text-xl font-bold tracking-wider md:text-2xl font-mono tabular-nums';
  const pulse = pulsing
    ? 'scale-110 shadow-lg shadow-red-500/25 transition-transform duration-[1800ms] ease-out'
    : 'scale-100 transition-transform duration-500 ease-out';

  if (tier === 'critical') {
    return `${size} ${pulse} rounded-2xl border border-red-500 bg-red-950/30 px-6 py-2.5 text-red-400 font-black`;
  }
  if (tier === 'amber') {
    return `${size} ${pulse} rounded-2xl border border-amber-500/40 bg-amber-950/20 px-6 py-2.5 text-amber-400`;
  }
  return `${size} ${pulse} rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-2.5 text-slate-200`;
}
