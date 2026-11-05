'use client';

import Link from 'next/link';
import { Briefcase, Lock, MapPin, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { writeGuestBudgetLead } from '@/lib/guest-lead/storage';

import { evaluateBudgetSimulator } from '@/lib/budget-simulator/evaluator';
import {
  BUDGET_REGISTER_HREF,
  type BudgetCatalogEntry,
  type BudgetInput,
  type PreferredAccommodation,
  type TuitionTolerance,
} from '@/lib/budget-simulator/types';

const SLIDER_MIN = 600;
const SLIDER_MAX = 3000;
const SLIDER_STEP = 50;

const TUITION_OPTIONS: {
  value: TuitionTolerance;
  label: string;
  hint: string;
}[] = [
  {
    value: 'FREE_ONLY',
    label: 'Sadece harçsız / sembolik',
    hint: '≤ ~1.000 €/yıl',
  },
  {
    value: 'LOW',
    label: 'Ekonomik',
    hint: '< 4.000 €/yıl',
  },
  { value: 'ANY', label: 'Fark etmez', hint: 'Tüm segmentler' },
];

const ACCOMMODATION_OPTIONS: {
  value: PreferredAccommodation;
  label: string;
}[] = [
  { value: 'DORM', label: 'Öğrenci yurdu' },
  { value: 'SHARED', label: 'WG / paylaşımlı' },
  { value: 'STUDIO', label: 'Stüdyo / tek kişilik' },
];

interface BudgetSimulatorClientProps {
  catalog: BudgetCatalogEntry[];
}

export function BudgetSimulatorClient({
  catalog,
}: BudgetSimulatorClientProps): ReactNode {
  const [monthlyBudget, setMonthlyBudget] = useState(1000);
  const [tuitionTolerance, setTuitionTolerance] =
    useState<TuitionTolerance>('LOW');
  const [preferredAccommodation, setPreferredAccommodation] =
    useState<PreferredAccommodation>('SHARED');
  const [submitted, setSubmitted] = useState<BudgetInput | null>(null);

  const result = useMemo(() => {
    if (!submitted) return null;
    return evaluateBudgetSimulator(submitted, catalog);
  }, [submitted, catalog]);

  useEffect(() => {
    if (!submitted || !result) return;
    writeGuestBudgetLead(submitted, result);
  }, [submitted, result]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted({
      monthlyBudget,
      tuitionTolerance,
      preferredAccommodation,
    });
  }

  if (result && submitted) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 pb-16">
        <div className="rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-violet-500/10 p-8">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-sky-300/30 bg-sky-500/20">
              <Wallet className="size-7 text-sky-200" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-200/90">
                Yaşam maliyeti teşhisi · Misafir
              </p>
              <h1 className="mt-1 text-balance text-2xl font-semibold text-slate-50 sm:text-3xl">
                Bütçeniz{' '}
                <span className="text-sky-200">
                  {result.matchedCountriesCount} ülkede
                </span>
                ,{' '}
                <span className="text-sky-200">
                  {result.matchedCitiesCount} şehirde
                </span>{' '}
                ve{' '}
                <span className="text-sky-200">
                  {result.matchedUniversitiesCount} üniversitede
                </span>{' '}
                eğitimi karşılıyor!
              </h1>
              <p className="mt-3 text-sm text-slate-400">
                Model: aylık yaşam + (yıllık harç ÷ 10) ≤ €
                {submitted.monthlyBudget}/ay
              </p>
            </div>
          </div>

          <p className="mt-6 text-pretty text-sm leading-relaxed text-slate-300">
            {result.matchedUniversitiesSummary}
          </p>

          {result.partTimeInsightPill ? (
            <p className="mt-4 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-xs leading-relaxed text-emerald-100/95">
              {result.partTimeInsightPill}
            </p>
          ) : null}

          {result.sampleCities.length > 0 ? (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {result.sampleCities.map((sample) => (
                <li
                  key={`${sample.country}-${sample.city}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
                >
                  <p className="text-2xl" aria-hidden>
                    {sample.flagEmoji}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-slate-100">
                    <MapPin className="size-4 text-sky-300" aria-hidden />
                    {sample.city}, {sample.country}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Örnek: {sample.exampleUniversity}
                  </p>
                  <p className="mt-3 text-lg font-bold tabular-nums text-sky-200">
                    ~€{sample.minMonthlyTotalEur}/ay
                  </p>
                  <p className="text-xs text-slate-500">Tahmini toplam gider</p>
                  {sample.partTimeWork ? (
                    <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-emerald-100">
                      <Briefcase
                        className="mt-0.5 size-3.5 shrink-0 text-emerald-300"
                        aria-hidden
                      />
                      {sample.partTimeWork}
                    </p>
                  ) : null}
                  {sample.specialProgram ? (
                    <p className="mt-2 inline-flex rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-100">
                      {sample.specialProgram}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <div className="space-y-8 p-6 blur-md opacity-40 select-none pointer-events-none">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Eşleşen tüm üniversiteler & kabul barajları
              </h2>
              <ul className="mt-3 space-y-2">
                {result.lockedUniversities.map((u) => (
                  <li
                    key={`${u.name}-${u.city}`}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {u.city} · ~€{u.estimatedMonthlyTotalEur}/ay
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      SAT: {u.minSat ?? '—'} · IELTS: {u.minIelts ?? '—'} ·
                      A-Level: {u.minAlevel ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Yurt & WG başvuru tüyoları
              </h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {result.accommodationTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md rounded-2xl border border-sky-400/35 bg-slate-950/95 p-6 text-center shadow-2xl shadow-sky-950/40 backdrop-blur-md">
              <Lock className="mx-auto size-8 text-sky-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-50">
                🔒 Tüm Üniversite Listesini ve Kabul Koşullarını Aç
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Tam liste, baraj detayı ve konaklama rehberi ücretsiz hesapta
                saklanır.
              </p>
              <Link
                href={BUDGET_REGISTER_HREF}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Ücretsiz Hesap Oluştur ve Eşleşmeleri Kaydet
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="mt-3 w-full text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Bütçeyi yeniden hesapla
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-16">
      <div className="mb-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-sky-400/30 bg-sky-500/15">
          <Wallet className="size-7 text-sky-200" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
          Bütçe &amp; Yaşam Maliyeti Simülatörü
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Aylık bütçenize göre Avrupa şehirleri · üyelik gerekmez
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-xl"
      >
        <div>
          <div className="flex items-end justify-between gap-4">
            <label htmlFor="monthly-budget" className="text-sm font-medium text-slate-200">
              Aylık bütçe (yaşam + harç payı)
            </label>
            <span className="text-2xl font-bold tabular-nums text-sky-200">
              €{monthlyBudget}
              <span className="text-sm font-normal text-slate-500">/ay</span>
            </span>
          </div>
          <input
            id="monthly-budget"
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={SLIDER_STEP}
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(Number(e.target.value))}
            className="mt-4 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>€{SLIDER_MIN}</span>
            <span>€{SLIDER_MAX}</span>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-200">
            Yıllık harç toleransı
          </legend>
          <div className="mt-3 space-y-2">
            {TUITION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  tuitionTolerance === opt.value
                    ? 'border-sky-400/50 bg-sky-500/10 text-slate-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                }`}
              >
                <span>
                  <input
                    type="radio"
                    name="tuition"
                    className="sr-only"
                    checked={tuitionTolerance === opt.value}
                    onChange={() => setTuitionTolerance(opt.value)}
                  />
                  {opt.label}
                </span>
                <span className="text-xs text-slate-500">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-200">
            Konaklama tercihi
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACCOMMODATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreferredAccommodation(opt.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  preferredAccommodation === opt.value
                    ? 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40'
                    : 'border border-white/10 text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:brightness-110"
        >
          Eşleşmeleri hesapla
        </button>
      </form>
    </div>
  );
}
