'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Animasyonlu sayaç
// ---------------------------------------------------------------------------

export function useCountUp(target: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

// ---------------------------------------------------------------------------
// Dekoratif parçalar
// ---------------------------------------------------------------------------

export function GlowOrb({
  className,
  delay,
}: {
  className: string;
  delay: number;
}): ReactNode {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.15, 1] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

export function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_20px_70px_-30px_rgba(79,70,229,0.6)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorCard({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-300" />
      <div className="flex-1 leading-relaxed">{message}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-200/70 transition hover:bg-rose-500/20 hover:text-rose-100"
      >
        Kapat
      </button>
    </motion.div>
  );
}

/** Konfeti. Tarayıcıya özgü olduğu için dinamik yüklenir; hata deneyimi bozmaz. */
export async function fireConfetti(): Promise<void> {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default;
    const colors = ['#818cf8', '#c084fc', '#38bdf8', '#fbbf24', '#f472b6'];

    void confetti({
      particleCount: 90,
      spread: 70,
      origin: { x: 0.2, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    void confetti({
      particleCount: 90,
      spread: 70,
      origin: { x: 0.8, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    window.setTimeout(() => {
      void confetti({
        particleCount: 140,
        spread: 110,
        origin: { x: 0.5, y: 0.45 },
        colors,
        disableForReducedMotion: true,
      });
    }, 220);
  } catch {
    // Konfeti süslemedir; yüklenemezse deneyim bozulmasın.
  }
}
