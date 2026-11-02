'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ExamMode } from '@/lib/exam-shared';
import { EXAM_MODES } from '@/lib/exam-shared';
import { GlassCard } from './ui';

interface ExamCardListProps {
  activeMode: ExamMode | null;
  subject: string;
  questionCount: number;
  onSelectMode: (mode: ExamMode) => void;
  onSelectSubject: (subject: string) => void;
  onSelectQuestionCount: (count: number) => void;
  onStart: (mode: ExamMode) => void;
}

/**
 * Ana ekrandaki üç sınav motoru kartı ve seçim paneli.
 * Durum yukarıda tutulur; bu bileşen yalnızca sunum ve olay iletimi yapar.
 */
export function ExamCardList({
  activeMode,
  subject,
  questionCount,
  onSelectMode,
  onSelectSubject,
  onSelectQuestionCount,
  onStart,
}: ExamCardListProps): ReactNode {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-3">
        {EXAM_MODES.map((mode, index) => {
          const Icon = mode.icon;
          const isActive = activeMode?.id === mode.id;

          return (
            <motion.button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode)}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.08, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className={`group relative overflow-hidden rounded-3xl border p-6 text-left transition ${
                isActive
                  ? 'border-indigo-400/60 bg-indigo-500/10 ring-2 ring-indigo-400/40'
                  : `border-white/10 bg-white/[0.03] ring-1 ring-transparent hover:bg-white/[0.06] ${mode.ring}`
              }`}
            >
              <div
                className={`mb-5 inline-grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${mode.accent} shadow-lg`}
              >
                <Icon className="size-6 text-slate-950" />
              </div>
              <p className="text-base font-semibold">{mode.label}</p>
              <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                {mode.tagline}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {mode.description}
              </p>

              {isActive ? (
                <motion.span
                  layoutId="mode-check"
                  className="absolute top-5 right-5 grid size-6 place-items-center rounded-full bg-indigo-400 text-slate-950"
                >
                  <CheckCircle2 className="size-4" />
                </motion.span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {/* Seçim paneli */}
      <AnimatePresence mode="wait">
        {activeMode ? (
          <motion.div
            key={activeMode.id}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <GlassCard className="p-6">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-300">
                  {activeMode.subjects.length > 1 ? 'Ders' : 'Görev'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeMode.subjects.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onSelectSubject(option)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        subject === option
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-300">
                  Soru sayısı
                </span>
                <div className="flex gap-2">
                  {Array.from(
                    { length: activeMode.maxQuestions },
                    (_, index) => index + 1,
                  ).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onSelectQuestionCount(count)}
                      className={`size-9 rounded-xl border text-sm font-semibold transition ${
                        questionCount === count
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={() => onStart(activeMode)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110"
              >
                Sınavı oluştur
                <ArrowRight className="size-5" />
              </motion.button>
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
