'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ExamMode } from '@/lib/exam-shared';
import { EXAM_MODES } from '@/lib/exam-shared';
import {
  questionCountOptionsForHome,
  sessionFormatUiLabel,
  type ExamSessionFormatId,
} from '@/lib/exam/exam-session-formats';
import { isLibraryRecentlyAdded } from '@/lib/public-library/library-new-badge';
import { GlassCard } from './ui';
import { LibraryNewBadge } from '@/components/exam/LibraryNewBadge';

interface ExamCardListProps {
  activeMode: ExamMode | null;
  sessionFormat: ExamSessionFormatId;
  subject: string;
  questionCount: number;
  /** Açık havuzdan gelen son eklenen materyaller (Keşfet ile aynı YENİ rozeti). */
  recentPublicLibraries?: { id: string; title: string; createdAt: string }[];
  onSelectMode: (mode: ExamMode) => void;
  onSelectSessionFormat: (format: ExamSessionFormatId) => void;
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
  sessionFormat,
  subject,
  questionCount,
  recentPublicLibraries = [],
  onSelectMode,
  onSelectSessionFormat,
  onSelectSubject,
  onSelectQuestionCount,
  onStart,
}: ExamCardListProps): ReactNode {
  const countOptions =
    activeMode &&
    questionCountOptionsForHome(
      sessionFormat,
      activeMode.curriculum,
      activeMode.maxQuestions,
    );
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
              <div className="mb-5">
                <span className="text-sm font-medium text-slate-300">
                  Oturum türü
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      'diagnostic_drill',
                      'mini_mock',
                    ] as ExamSessionFormatId[]
                  ).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => onSelectSessionFormat(format)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        sessionFormat === format
                          ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-50'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {sessionFormatUiLabel(format)}
                    </button>
                  ))}
                </div>
              </div>

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
                  {(countOptions ?? []).map((count) => (
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
                {sessionFormat === 'mini_mock'
                  ? 'Mini Denemeyi başlat'
                  : 'Diagnostic Drill başlat'}
                <ArrowRight className="size-5" />
              </motion.button>
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {recentPublicLibraries.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Haftalık hazır deneme havuzu (öğrenci paneli)
          </p>
          <ul className="mt-3 space-y-2">
            {recentPublicLibraries.slice(0, 4).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300"
              >
                <span className="min-w-0 truncate">{item.title}</span>
                {isLibraryRecentlyAdded(item.createdAt) ? (
                  <LibraryNewBadge />
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            Bu denemeler önceden üretilir; başlatınca yapay zeka tekrar çalışmaz.
          </p>
        </div>
      ) : null}
    </>
  );
}
