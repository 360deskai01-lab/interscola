'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { createCustomExamFromMaterialAction } from '@/app/student/studio-actions';
import {
  DIAGNOSTIC_DRILL_QUESTIONS,
  MINI_MOCK_QUESTIONS,
} from '@/lib/exam/exam-session-formats';
import {
  STUDIO_CURRICULA,
  STUDIO_MAX_MATERIAL_CHARS,
  STUDIO_MAX_PDF_BYTES,
  STUDIO_MIN_MATERIAL_CHARS,
  type StudioScope,
} from '@/lib/student-studio/constants';
import { StudentHubNav } from '@/components/student/StudentHubNav';
import type { CurriculumCode } from '@/types/exam';

const SCOPES: { id: StudioScope; label: string; blurb: string }[] = [
  {
    id: 'quick',
    label: 'Hızlı Seviye (3-5 Soru)',
    blurb: '~15 dk mikro alıştırma',
  },
  {
    id: 'comprehensive',
    label: 'Kapsamlı Pratik (10-12 Soru)',
    blurb: '~18 dk bölüm pratiği',
  },
];

const STEP_TITLES = ['Belge / Metin', 'Hedef Motor', 'Kapsam'] as const;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentStudioClient(): ReactNode {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [curriculum, setCurriculum] = useState<CurriculumCode | null>(null);
  const [scope, setScope] = useState<StudioScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasMaterial = file !== null || text.trim().length >= STUDIO_MIN_MATERIAL_CHARS;

  function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    setError(null);
    const isPdf =
      candidate.type === 'application/pdf' ||
      candidate.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Yalnızca PDF dosyası yükleyebilirsin.');
      return;
    }
    if (candidate.size > STUDIO_MAX_PDF_BYTES) {
      setError(`PDF en fazla ${formatMb(STUDIO_MAX_PDF_BYTES)} olabilir.`);
      return;
    }
    setFile(candidate);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function canAdvance(): boolean {
    if (step === 0) return hasMaterial;
    if (step === 1) return curriculum !== null;
    return scope !== null;
  }

  function handleGenerate() {
    if (!curriculum || !scope || !hasMaterial) return;
    setError(null);

    const formData = new FormData();
    formData.set('curriculum', curriculum);
    formData.set('scope', scope);
    formData.set('material_text', text.trim().slice(0, STUDIO_MAX_MATERIAL_CHARS));
    if (file) formData.set('material_pdf', file);

    startTransition(async () => {
      const result = await createCustomExamFromMaterialAction(formData);
      if (!result.success || !result.assignmentId) {
        setError(result.error ?? 'Sınav üretilemedi.');
        return;
      }
      router.push(`/exam-session/${result.assignmentId}`);
    });
  }

  const questionHint =
    curriculum && scope
      ? scope === 'quick'
        ? DIAGNOSTIC_DRILL_QUESTIONS[curriculum]
        : MINI_MOCK_QUESTIONS[curriculum]
      : null;

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.14),transparent_60%)]"
      />

      <header className="relative mb-8 flex flex-wrap items-center gap-3">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Panele dön
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            ✨
          </span>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              AI Sınav Üretici
              <span className="rounded-md border border-violet-400/40 bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-100">
                BETA
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Ders notunu veya PDF’ini kişisel bir sınava dönüştür.
            </p>
          </div>
        </div>
      </header>

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start">
        <StudentHubNav currentHref="/student/studio" />

        <div className="min-w-0 flex-1 space-y-6">
          <ol className="grid grid-cols-3 gap-2" aria-label="Adımlar">
            {STEP_TITLES.map((title, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li
                  key={title}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                    active
                      ? 'border-violet-400/45 bg-violet-500/15 text-violet-50'
                      : done
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-500'
                  }`}
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[10px]">
                    {done ? <Check className="size-3" /> : index + 1}
                  </span>
                  <span className="truncate">{title}</span>
                </li>
              );
            })}
          </ol>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            {step === 0 ? (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-slate-200">
                  1. Adım — Belge veya metin
                </h2>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    dragOver
                      ? 'border-violet-400/60 bg-violet-500/10'
                      : 'border-white/15 bg-slate-900/40'
                  }`}
                >
                  <Upload className="size-6 text-violet-300" />
                  <p className="text-sm text-slate-300">
                    PDF’ini buraya sürükle-bırak
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.1]"
                  >
                    veya dosya seç
                  </button>
                  <p className="text-[11px] text-slate-500">
                    En fazla {formatMb(STUDIO_MAX_PDF_BYTES)} · Metin içeren
                    (taranmamış) PDF
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      acceptFile(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </div>

                {file ? (
                  <div className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
                    <FileText className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-violet-200/70">
                      {formatMb(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="rounded p-1 text-violet-200/70 hover:bg-white/10 hover:text-white"
                      aria-label="PDF’i kaldır"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}

                <label className="block text-xs text-slate-500">
                  veya ders notu / metin yapıştır
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={8}
                    maxLength={STUDIO_MAX_MATERIAL_CHARS}
                    placeholder="Konu anlatımı, makale veya ders notunu buraya yapıştır…"
                    className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400/40"
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  {text.trim().length} / {STUDIO_MAX_MATERIAL_CHARS} karakter ·
                  en az {STUDIO_MIN_MATERIAL_CHARS} karakter (veya PDF) gerekir.
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-slate-200">
                  2. Adım — Hedef motor
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {STUDIO_CURRICULA.map((option) => {
                    const selected = curriculum === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setCurriculum(option.id)}
                        aria-pressed={selected}
                        className={`rounded-xl border p-4 text-left transition ${
                          selected
                            ? 'border-violet-400/50 bg-violet-500/15 text-white'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {option.hint}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-slate-200">
                  3. Adım — Kapsam
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SCOPES.map((option) => {
                    const selected = scope === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScope(option.id)}
                        aria-pressed={selected}
                        className={`rounded-xl border p-4 text-left transition ${
                          selected
                            ? 'border-violet-400/50 bg-violet-500/15 text-white'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {option.blurb}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {questionHint !== null ? (
                  <p className="text-[11px] text-slate-500">
                    {curriculum === 'SAT'
                      ? `SAT için ${questionHint} soru üretilecek.`
                      : `${curriculum} yazılı görev formatında ${questionHint} görev üretilecek (soru sayısı motorun müfredat sınırına göre belirlenir).`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((current) => Math.max(0, current - 1));
              }}
              disabled={step === 0 || pending}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              Geri
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((current) => current + 1);
                }}
                disabled={!canAdvance()}
                className="rounded-xl border border-violet-400/40 bg-violet-500/20 px-5 py-2 text-sm font-medium text-violet-50 transition hover:bg-violet-500/30 disabled:opacity-40"
              >
                Devam
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canAdvance() || pending}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/25 px-5 py-2 text-sm font-medium text-white transition hover:border-violet-300/60 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {pending ? 'Sınav hazırlanıyor… (≈30 sn)' : 'Sınavı Üret ve Başla'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
