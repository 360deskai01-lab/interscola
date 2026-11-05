'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Lock, PiggyBank, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { writeGuestScholarshipLead } from '@/lib/guest-lead/storage';

import { evaluateScholarshipSimulator } from '@/lib/scholarship-simulator/evaluator';
import {
  SCHOLARSHIP_REGISTER_HREF,
  type ScholarshipSimulatorInput,
} from '@/lib/scholarship-simulator/types';

type StepKey = keyof ScholarshipSimulatorInput;

type StepDef = {
  key: StepKey;
  title: string;
  subtitle: string;
  options: { value: ScholarshipSimulatorInput[StepKey]; label: string; hint?: string }[];
};

const STEPS: StepDef[] = [
  {
    key: 'targetCountry',
    title: 'Hedef ülke veya bölge',
    subtitle: 'Burs kriterleri ülkeye göre değişir (DSU, BAföG, merit vb.).',
    options: [
      { value: 'italy', label: 'İtalya', hint: 'DSU / ER.GO' },
      { value: 'germany', label: 'Almanya', hint: 'Sosyal katkı' },
      { value: 'netherlands', label: 'Hollanda', hint: 'Merit bursları' },
      { value: 'uk', label: 'Birleşik Krallık' },
      { value: 'other_eu', label: 'Diğer AB / Avrupa' },
    ],
  },
  {
    key: 'householdIncome',
    title: 'Yıllık net hane geliri (EUR)',
    subtitle: 'DSU ve ISEE benzeri hesaplarda temel girdi.',
    options: [
      { value: 'under_15k', label: '15.000 € altı' },
      { value: '15_30k', label: '15.000 – 30.000 €' },
      { value: '30_55k', label: '30.000 – 55.000 €' },
      { value: 'over_55k', label: '55.000 € üzeri' },
    ],
  },
  {
    key: 'propertyOwnership',
    title: 'Gayrimenkul mülkiyeti',
    subtitle: 'Konut durumu need-based puanı etkiler.',
    options: [
      { value: 'rent', label: 'Kira' },
      { value: 'one_home', label: '1 mülk (aile konutu)' },
      { value: 'multiple', label: 'Birden fazla mülk' },
    ],
  },
  {
    key: 'studentsInFamily',
    title: 'Ailedeki öğrenci sayısı',
    subtitle: 'Kardeş sayısı DSU hane yükü hesabında artırıcıdır.',
    options: [
      { value: '1', label: '1 öğrenci' },
      { value: '2', label: '2 öğrenci' },
      { value: '3_plus', label: '3 veya daha fazla' },
    ],
  },
  {
    key: 'maxFamilyContribution',
    title: 'Yıllık maksimum aile katkısı',
    subtitle: 'Eğitim için ayırabileceğiniz üst sınır.',
    options: [
      { value: 'under_2k', label: '2.000 € altı' },
      { value: '2_5k', label: '2.000 – 5.000 €' },
      { value: '5_10k', label: '5.000 – 10.000 €' },
      { value: 'over_10k', label: '10.000 € üzeri' },
    ],
  },
  {
    key: 'highSchoolGpa',
    title: 'Lise not ortalaması (GPA / 100)',
    subtitle: 'Merit bursları için akademik eşik.',
    options: [
      { value: 'below_70', label: '70 altı' },
      { value: '70_80', label: '70 – 80' },
      { value: '80_90', label: '80 – 90' },
      { value: '90_plus', label: '90 ve üzeri' },
    ],
  },
  {
    key: 'examStatus',
    title: 'Sınav durumu',
    subtitle: 'SAT, A-Level veya IB profili.',
    options: [
      { value: 'none', label: 'Henüz yok / planlı' },
      { value: 'sat_mid', label: 'SAT (≈ 1200–1350)' },
      { value: 'sat_high', label: 'SAT (1350+)' },
      { value: 'a_level', label: 'A-Level / CAIE' },
      { value: 'ib', label: 'IB Diploma' },
    ],
  },
  {
    key: 'englishProficiency',
    title: 'İngilizce yeterliliği',
    subtitle: 'IELTS / TOEFL bandı merit ve kabul için kritik.',
    options: [
      { value: 'none', label: 'Henüz yok' },
      { value: 'ielts_5', label: 'IELTS ~5.0–5.5' },
      { value: 'ielts_6', label: 'IELTS ~6.0–6.5' },
      { value: 'ielts_7_plus', label: 'IELTS 7.0+' },
      { value: 'toefl_90_plus', label: 'TOEFL 90+' },
    ],
  },
];

type Phase = 'quiz' | 'results';

function ScoreRing({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'indigo';
}): ReactNode {
  const ring =
    accent === 'emerald'
      ? 'from-emerald-400 to-teal-500 text-emerald-100'
      : 'from-indigo-400 to-violet-500 text-indigo-100';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 bg-gradient-to-r bg-clip-text text-4xl font-bold tabular-nums text-transparent ${ring}`}
      >
        %{value}
      </p>
    </div>
  );
}

export function ScholarshipSimulatorClient(): ReactNode {
  const [phase, setPhase] = useState<Phase>('quiz');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<ScholarshipSimulatorInput>>({});

  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const result = useMemo(() => {
    if (phase !== 'results') return null;
    const complete = answers as ScholarshipSimulatorInput;
    return evaluateScholarshipSimulator(complete);
  }, [phase, answers]);

  const pickOption = useCallback(
    (value: ScholarshipSimulatorInput[StepKey]) => {
      if (!step) return;
      const nextAnswers = { ...answers, [step.key]: value };
      setAnswers(nextAnswers);
      if (stepIndex >= STEPS.length - 1) {
        setPhase('results');
        return;
      }
      setStepIndex((i) => i + 1);
    },
    [answers, step, stepIndex],
  );

  const restart = useCallback(() => {
    setPhase('quiz');
    setStepIndex(0);
    setAnswers({});
  }, []);

  useEffect(() => {
    if (phase !== 'results' || !result) return;
    writeGuestScholarshipLead(answers as ScholarshipSimulatorInput, result);
  }, [phase, result, answers]);

  if (phase === 'results' && result) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 pb-16">
        <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-indigo-500/10 to-violet-500/10 p-8">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-500/20">
              <PiggyBank className="size-7 text-emerald-200" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
                Burs teşhis özeti · Misafir
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-50 sm:text-3xl">
                Uygunluk karne taslağı
              </h1>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ScoreRing
              label="Finansal Destek Uygunluğu (Need-Based)"
              value={result.needBasedScore}
              accent="emerald"
            />
            <ScoreRing
              label="Akademik Başarı Bursu (Merit)"
              value={result.meritBasedScore}
              accent="indigo"
            />
          </div>

          <p className="mt-6 text-pretty text-sm leading-relaxed text-slate-300">
            {result.summaryParagraph}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Örnek uyumlu programlar
          </h2>
          <ul className="mt-4 space-y-3">
            {result.matches.slice(0, 2).map((match) => (
              <li
                key={match.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-indigo-300">
                      {match.country}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-100">
                      {match.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {match.institution}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{match.tagline}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                    %{match.fitPercent} uyum
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <div className="space-y-8 p-6 blur-md opacity-40 select-none pointer-events-none">
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Award className="size-4" aria-hidden />
                ISEE Parificato gelir denklik evrak listesi
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {result.lockedTeaser.iseeDocumentList.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Konsolosluk / apostil gereksinimleri
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {result.lockedTeaser.consulateApostilleNotes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Burs başvuru takvimi ve son tarihler
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {result.lockedTeaser.applicationCalendar.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md rounded-2xl border border-emerald-400/35 bg-slate-950/95 p-6 text-center shadow-2xl shadow-emerald-950/40 backdrop-blur-md">
              <Lock className="mx-auto size-8 text-emerald-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-50">
                🔒 Burs Başvuru Yol Haritasını ve Evrak Rehberini Aç
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                ISEE listesi, apostil adımları ve dönem takvimi ücretsiz hesapta
                portföyünüze kaydedilir.
              </p>
              <Link
                href={SCHOLARSHIP_REGISTER_HREF}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Ücretsiz Hesap Oluştur ve Portföyü Kaydet
              </Link>
              <button
                type="button"
                onClick={restart}
                className="mt-3 w-full text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Simülasyonu yeniden başlat
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="mb-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15">
          <Sparkles className="size-7 text-indigo-200" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
          Burs &amp; Maliyet Uygunluk Simülatörü
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          8 kısa adım · üyelik gerekmez · ~2 dakika
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-xl">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Adım {stepIndex + 1} / {STEPS.length}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            <h2 className="text-lg font-semibold leading-snug text-slate-50">
              {step.title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{step.subtitle}</p>
            <div className="mt-6 space-y-2">
              {step.options.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => pickOption(opt.value)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
                >
                  <span>{opt.label}</span>
                  {opt.hint ? (
                    <span className="shrink-0 text-xs text-slate-500">
                      {opt.hint}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            className="mt-6 text-xs text-slate-500 hover:text-slate-300"
          >
            ← Önceki adım
          </button>
        ) : null}
      </div>
    </div>
  );
}
