'use client';

import Link from 'next/link';
import { Lock, Trophy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { ExamResultTimedOutBanner } from '@/components/exam/ExamResultCard';
import {
  readGuestDiagnosticFromStorage,
  type GuestDiagnosticRecord,
} from '@/lib/test-et/guest-diagnostic-storage';
import { TEST_ET_VITRINE, testEtHref, type TestEtSlug } from '@/lib/test-et/test-et-config';
import { registerUrlForDiagnostic } from '@/lib/safe-next-path';

interface GuestDiagnosticTeaserClientProps {
  slug: TestEtSlug;
}

export function GuestDiagnosticTeaserClient({
  slug,
}: GuestDiagnosticTeaserClientProps): ReactNode {
  const [record, setRecord] = useState<GuestDiagnosticRecord | null>(null);

  useEffect(() => {
    setRecord(readGuestDiagnosticFromStorage());
  }, []);

  const vitrine = TEST_ET_VITRINE[slug];

  if (!record || record.slug !== slug) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-slate-300">
          Henüz bu teşhis için kayıtlı bir misafir sonucu yok.
        </p>
        <Link
          href={`${testEtHref(slug)}/solve`}
          className="mt-4 inline-flex rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Teşhise başla
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {record.is_timed_out ? <ExamResultTimedOutBanner /> : null}
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-indigo-500/10 to-violet-500/10 p-8 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-emerald-300/40 bg-emerald-500/20">
          <Trophy className="size-8 text-emerald-200" aria-hidden />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
          {vitrine.badgeLabel} · Teşhis özeti
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-slate-50">
          {record.headlineScore}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          {record.summary}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        <div className="space-y-6 p-6 blur-md select-none opacity-40 pointer-events-none">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Soru bazlı döküm
            </h2>
            <ul className="mt-3 space-y-2">
              {record.lockedTeaser.questionBreakdown.map((item) => (
                <li
                  key={item.questionId}
                  className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200"
                >
                  {item.label} — {item.status}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Kriter / rubrik dağılımı
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {record.lockedTeaser.rubricBreakdown.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{line.label}</span>
                  <span className="font-semibold text-indigo-200">{line.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Geliştirilmesi gereken zayıf kazanımlar
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {record.lockedTeaser.weakTopics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-md rounded-2xl border border-indigo-400/40 bg-slate-950/95 p-6 text-center shadow-2xl shadow-indigo-950/50 backdrop-blur-md">
            <Lock className="mx-auto size-8 text-indigo-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-50">
              🔒 Detaylı Soru Analizini ve Eksik Konu Raporunu Aç
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Rubrik dökümü, soru bazlı geri bildirim ve kişisel gelişim planı
              ücretsiz öğrenci hesabında saklanır.
            </p>
            <Link
              href={registerUrlForDiagnostic(record.curriculum)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Ücretsiz Hesap Oluştur ve Karneni Kaydet
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
