'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronsRight,
} from 'lucide-react';
import type { AssessmentPayload, ExamQuestion } from '@/types/exam';
import { countWords, stripOptionLabel } from '@/lib/exam-shared';
import {
  inferSessionFormat,
  sessionFormatUiLabel,
} from '@/lib/exam/exam-session-formats';
import { ExamCountdownTimer } from '@/components/exam/ExamCountdownTimer';
import { GlassCard } from './ui';

// ---------------------------------------------------------------------------
// Soru görünümleri
// ---------------------------------------------------------------------------

function ChoiceQuestion({
  question,
  selected,
  onSelect,
  disabled,
}: {
  question: ExamQuestion;
  selected: string | undefined;
  onSelect: (letter: string) => void;
  disabled: boolean;
}): ReactNode {
  const options = question.options ?? [];

  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const isSelected = selected === letter;

        return (
          <motion.button
            key={`${question.id}-${letter}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(letter)}
            whileHover={disabled ? undefined : { scale: 1.01 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${
              isSelected
                ? 'border-indigo-400/70 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.5)]'
                : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
            }`}
            aria-pressed={isSelected}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl border text-sm font-semibold transition ${
                isSelected
                  ? 'border-indigo-300/70 bg-indigo-400/20 text-indigo-100'
                  : 'border-white/15 bg-white/[0.04] text-slate-300 group-hover:text-white'
              }`}
            >
              {letter}
            </span>
            <span className="flex-1 text-[15px] leading-relaxed text-slate-100">
              {stripOptionLabel(option)}
            </span>
            {isSelected ? (
              <CheckCircle2 className="size-5 shrink-0 text-indigo-300" />
            ) : null}
          </motion.button>
        );
      })}
      <p className="pt-1 text-xs text-slate-500">
        İpucu: klavyeden <span className="font-semibold text-slate-400">A</span>-
        <span className="font-semibold text-slate-400">D</span> tuşlarıyla da
        seçebilirsin.
      </p>
    </div>
  );
}

function WritingQuestion({
  question,
  value,
  onChange,
  showWordCount,
  showIeltsLengthHint,
  disabled,
}: {
  question: ExamQuestion;
  value: string;
  onChange: (next: string) => void;
  showWordCount: boolean;
  showIeltsLengthHint: boolean;
  disabled: boolean;
}): ReactNode {
  const words = countWords(value);
  const isExtended = question.type === 'extended_essay';
  const minHeightClass = isExtended ? 'min-h-[320px]' : 'min-h-[200px]';

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            isExtended
              ? 'Genişletilmiş yanıtını sürekli metin olarak yaz…'
              : 'Yapılandırılmış yanıtını maddeler halinde veya kısa paragraflarla yaz…'
          }
          spellCheck
          className={`${minHeightClass} w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-[15px] leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10`}
        />
        {showWordCount ? (
          <div className="pointer-events-none absolute right-4 bottom-3 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-400 backdrop-blur">
            {words} kelime
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-100">
          {question.targetMarks} Marks
        </span>
        {showIeltsLengthHint && words > 0 && words < 150 ? (
          <span className="text-amber-400/80">
            IELTS Task 2 için yaklaşık 250 kelime beklenir.
          </span>
        ) : null}
        {question.type === 'extended_essay' && words > 0 && words < 80 ? (
          <span className="text-sky-300/80">
            CAIE genişletilmiş yanıtta değerlendirme (AO3) için yeterli gelişim
            önerilir.
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sınav ekranı
// ---------------------------------------------------------------------------

interface ExamRunnerProps {
  exam: AssessmentPayload;
  question: ExamQuestion;
  currentIndex: number;
  totalQuestions: number;
  answers: Record<string, string>;
  secondsLeft: number;
  direction: number;
  requiresEveryAnswer: boolean;
  answeredEvery: boolean;
  unansweredCount: number;
  onAnswer: (questionId: string, answer: string) => void;
  onNavigate: (index: number) => void;
  onFinish: () => void;
  finishLabel?: string;
  /** Çift gönderim veya değerlendirme sırasında bitir düğmesini kilitler. */
  finishDisabled?: boolean;
  /** Değerlendirme / otomatik gönderim sırasında yanıt girişlerini kilitler. */
  isGrading?: boolean;
}

/**
 * Sınav çözme ekranı. Klavye kısayolu (SAT için A-D) ve süre sayacı
 * yan etkileri `page.tsx`'te yönetilir; bu bileşen sunuma odaklıdır.
 */
export function ExamRunner({
  exam,
  question,
  currentIndex,
  totalQuestions,
  answers,
  secondsLeft,
  direction,
  requiresEveryAnswer,
  answeredEvery,
  unansweredCount,
  onAnswer,
  onNavigate,
  onFinish,
  finishLabel = 'Sınavı bitir',
  finishDisabled = false,
  isGrading = false,
}: ExamRunnerProps): ReactNode {
  const inputsLocked = secondsLeft <= 0 || isGrading;
  const isOpenResponse =
    question.type === 'structured_text' || question.type === 'extended_essay';
  const showWordCount =
    exam.engineType === 'LANGUAGE' ||
    exam.curriculum === 'CAIE' ||
    isOpenResponse;

  return (
    <motion.section
      key="exam"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.4 }}
    >
      <header className="sticky top-0 z-30 -mx-1 mb-6 border-b border-white/10 bg-slate-950/92 px-1 pb-4 pt-2 backdrop-blur-md sm:-mx-2 sm:px-2">
        <div className="flex flex-col items-center gap-3">
          <ExamCountdownTimer secondsLeft={secondsLeft} />
          <div className="flex w-full max-w-4xl flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 text-left">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {exam.subject} · {exam.curriculum}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
                {exam.title}
              </h2>
              <p className="mt-1 text-[11px] font-medium text-amber-200/90">
                {sessionFormatUiLabel(inferSessionFormat(exam))}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 tabular-nums">
                Soru {currentIndex + 1} / {totalQuestions}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                {exam.totalMarks} puan
              </span>
            </div>
          </div>
        </div>
      </header>

      <GlassCard className="overflow-hidden p-6 sm:p-8">
        <div className="relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={question.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -48 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-5 flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-sm font-semibold">
                  {question.questionNumber}
                </span>
                <div className="flex-1">
                  <p className="text-[15px] leading-relaxed whitespace-pre-line text-slate-100 sm:text-base">
                    {question.prompt}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                      {question.targetMarks} Marks
                    </span>
                    {question.type === 'multiple_choice' ? (
                      <span className="text-xs text-slate-500">
                        Tek doğru yanıt
                      </span>
                    ) : null}
                    {isOpenResponse ? (
                      <span className="text-xs text-slate-500">
                        AO1 · AO2 · AO3 rubrik
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {question.type === 'multiple_choice' ? (
                <ChoiceQuestion
                  question={question}
                  selected={answers[question.id]}
                  onSelect={(letter) => onAnswer(question.id, letter)}
                  disabled={inputsLocked}
                />
              ) : (
                <WritingQuestion
                  question={question}
                  value={answers[question.id] ?? ''}
                  onChange={(next) => onAnswer(question.id, next)}
                  showWordCount={showWordCount}
                  showIeltsLengthHint={exam.engineType === 'LANGUAGE'}
                  disabled={inputsLocked}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300 transition enabled:hover:border-white/25 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft className="size-4" />
            Geri
          </button>

          <div className="flex items-center gap-2">
            {exam.questions.map((item, index) => {
              const answered = (answers[item.id] ?? '').trim() !== '';
              const isCurrent = index === currentIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(index)}
                  aria-label={`Soru ${index + 1}`}
                  className={`size-2.5 rounded-full transition ${
                    isCurrent
                      ? 'scale-125 bg-indigo-400'
                      : answered
                        ? 'bg-emerald-400/70 hover:bg-emerald-300'
                        : 'bg-white/20 hover:bg-white/40'
                  }`}
                />
              );
            })}
          </div>

          {currentIndex < totalQuestions - 1 ? (
            <motion.button
              type="button"
              onClick={() => onNavigate(currentIndex + 1)}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
            >
              İleri
              <ArrowRight className="size-4" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={onFinish}
              disabled={
                finishDisabled || (requiresEveryAnswer && !answeredEvery)
              }
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsRight className="size-4" />
              {finishLabel}
            </motion.button>
          )}
        </div>

        {requiresEveryAnswer && !answeredEvery ? (
          <p className="mt-3 text-xs text-amber-400/80">
            {unansweredCount} soru yanıtsız. Bu motor metin değerlendirmesi
            yaptığı için tüm soruların yanıtlanması gerekiyor.
          </p>
        ) : null}
      </GlassCard>
    </motion.section>
  );
}
