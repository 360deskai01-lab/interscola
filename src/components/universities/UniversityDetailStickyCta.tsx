'use client';

import type { ReactNode } from 'react';
import { Target } from 'lucide-react';
import type {
  StudentLatestScores,
  University,
} from '@/app/universities/actions';
import { AcceptanceMatchStatus } from '@/components/universities/AcceptanceMatchStatus';
import { DiagnosticExploreLink } from '@/components/universities/DiagnosticExploreLink';

interface UniversityDetailStickyCtaProps {
  university: University;
  studentScores: StudentLatestScores;
}

/**
 * Detay sayfası sağ kolon: oturum/skora göre baraj kıyası veya teşhis köprüsü.
 */
export function UniversityDetailStickyCta({
  university,
  studentScores,
}: UniversityDetailStickyCtaProps): ReactNode {
  const hasAnyScore =
    studentScores.satScore !== null ||
    studentScores.ieltsBand !== null ||
    studentScores.caieGrade !== null;

  return (
    <aside className="rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-cyan-500/10 via-slate-950/80 to-indigo-950/40 p-5 shadow-lg shadow-cyan-950/20 lg:sticky lg:top-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-200/90">
        <Target className="size-3.5" />
        Kabul Şansını Hesapla
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {hasAnyScore
          ? 'Deneme skorlarını bu üniversitenin barajlarıyla karşılaştır.'
          : '15 dakikalık ücretsiz teşhis ile SAT/IELTS seviyeni ölç; baraj uyumunu anında gör.'}
      </p>

      <div className="mt-4 space-y-3">
        <AcceptanceMatchStatus
          university={university}
          studentScores={studentScores}
          variant="detail"
        />
        {!hasAnyScore ? (
          <DiagnosticExploreLink
            label="15 Dk Ücretsiz Teşhis Çöz"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/45 bg-cyan-500/20 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/30"
          />
        ) : null}
      </div>
    </aside>
  );
}
