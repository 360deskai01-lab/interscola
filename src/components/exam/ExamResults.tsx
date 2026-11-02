'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import type { AssessmentPayload, EvaluationResult } from '@/types/exam';
import {
  buildBadges,
  formatScore,
  isHighScore,
  metricLabel,
  metricSuffix,
} from '@/lib/exam-shared';
import { GlassCard, fireConfetti, useCountUp } from './ui';

interface ExamResultsProps {
  exam: AssessmentPayload;
  evaluation: EvaluationResult;
  finishedFast: boolean;
  answeredEvery: boolean;
  /**
   * Karne geçmişten mi açıldı?
   * `true` ise konfeti tetiklenmez: kullanıcı yeni bir başarı kazanmadı,
   * yalnızca eski bir kaydı inceliyor.
   */
  isHistoryView?: boolean;
  reviewHref?: string;
  retryLabel?: string;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Karne ekranı: animasyonlu skor, rozetler, puan kırılımı ve eksik kazanımlar.
 */
export function ExamResults({
  exam,
  evaluation,
  finishedFast,
  answeredEvery,
  isHistoryView = false,
  reviewHref,
  retryLabel,
  onRetry,
  onHome,
}: ExamResultsProps): ReactNode {
  const animatedScore = useCountUp(evaluation.score);
  const high = isHighScore(exam.engineType, evaluation);
  const badges = buildBadges(
    exam.engineType,
    evaluation,
    answeredEvery,
    finishedFast,
  );

  const breakdownEntries = Object.entries(evaluation.metricBreakdown);

  /*
   * Konfeti yalnızca taze çözülmüş sınavda patlar. Geçmiş bir denemeyi
   * incelerken kutlama yapmak yanıltıcı olurdu.
   */
  useEffect(() => {
    if (isHistoryView || !high) return;
    void fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.section
      key="results"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -22 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="relative overflow-hidden p-8 text-center sm:p-10">
        {high ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_65%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
        ) : null}

        <div className="relative">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className={`mx-auto grid size-16 place-items-center rounded-3xl ${
              high
                ? 'bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500'
                : 'bg-gradient-to-br from-slate-600 to-slate-700'
            } shadow-xl`}
          >
            {high ? (
              <Trophy className="size-8 text-slate-950" />
            ) : (
              <Target className="size-8 text-white" />
            )}
          </motion.div>

          <p className="mt-5 text-xs font-medium tracking-wide text-slate-500 uppercase">
            {exam.subject} · {exam.curriculum}
          </p>

          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-6xl font-semibold tracking-tight text-transparent tabular-nums">
              {formatScore(exam.engineType, animatedScore)}
            </span>
            {exam.engineType === 'LANGUAGE' ? (
              <span className="text-lg text-slate-500">/ 9.0 band</span>
            ) : exam.engineType === 'OBJECTIVE' ? (
              <span className="text-lg text-slate-500">/ 1600</span>
            ) : (
              <span className="text-lg text-slate-500">
                / {evaluation.maxScore} puan
              </span>
            )}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-200"
          >
            {evaluation.scaledResult}
          </motion.p>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            {evaluation.feedback}
          </p>
        </div>
      </GlassCard>

      {/* Rozetler */}
      <div className="mt-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Sparkles className="size-4 text-indigo-400" />
          Kazanılan rozetler
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {badges.map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.35 + index * 0.1,
                type: 'spring',
                stiffness: 240,
                damping: 18,
              }}
              title={badge.hint}
              className="flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-100"
            >
              <span aria-hidden>{badge.emoji}</span>
              {badge.label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Kırılım */}
      {breakdownEntries.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Target className="size-4 text-cyan-400" />
            Puan kırılımı
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {breakdownEntries.map(([key, raw], index) => {
              const numeric =
                typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
              const hasScale = Number.isFinite(numeric);
              const width = hasScale
                ? Math.max(4, Math.min(100, (numeric / 9) * 100))
                : 100;

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">
                      {metricLabel(key)}
                    </span>
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {typeof raw === 'number'
                        ? Number.isInteger(raw)
                          ? raw
                          : raw.toFixed(1)
                        : String(raw)}
                      {metricSuffix(key)}
                    </span>
                  </div>
                  {exam.engineType === 'LANGUAGE' ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{
                          delay: 0.6 + index * 0.06,
                          duration: 0.6,
                        }}
                      />
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Eksik kazanımlar */}
      {evaluation.remedialTopics.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Flame className="size-4 text-orange-400" />
            Eksik kazanımlar
          </h3>
          <ul className="space-y-2">
            {evaluation.remedialTopics.map((topic, index) => (
              <motion.li
                key={`${index}-${topic.slice(0, 12)}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + index * 0.05 }}
                className="flex items-start gap-2.5 rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm leading-relaxed text-orange-100"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-300" />
                <span>{topic}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Eylemler */}
      <div className="mt-8 flex flex-wrap gap-3">
        {reviewHref ? (
          <Link
            href={reviewHref}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-violet-400/40 bg-violet-500/15 px-6 py-3.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
          >
            <Target className="size-4" />
            Karnemi / Yanlışlarımı Gör
          </Link>
        ) : null}
        <motion.button
          type="button"
          onClick={onRetry}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110"
        >
          <Zap className="size-4" />
          {retryLabel ?? 'Aynı modda tekrar dene'}
        </motion.button>
        <button
          type="button"
          onClick={onHome}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          <RotateCcw className="size-4" />
          Başka bir sınav seç
        </button>
      </div>
    </motion.section>
  );
}
