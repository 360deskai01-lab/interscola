'use client';

import type { ReactNode } from 'react';
import type { CurriculumCode, EngineType } from '@/types/exam';
import { getScoreTransparencyCopy } from '@/lib/exam/score-transparency';

/**
 * Karne üstündeki şeffaflık başlığı ve dipnotu — `ExamResults` ile paylaşılan sözleşme.
 */
export function ExamResultScoreHeading({
  curriculum,
  engineType,
}: {
  curriculum: CurriculumCode;
  engineType: EngineType;
}): ReactNode {
  const { scoreHeading } = getScoreTransparencyCopy(curriculum, engineType);
  return (
    <p className="mx-auto mt-4 max-w-xl rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-200">
      {scoreHeading}
    </p>
  );
}

export function ExamResultTimedOutBanner(): ReactNode {
  return (
    <div
      role="status"
      className="mb-6 rounded-2xl border border-rose-400/45 bg-gradient-to-r from-rose-500/20 via-amber-500/10 to-rose-500/15 px-5 py-4 text-center text-sm font-semibold text-rose-100 shadow-lg shadow-rose-950/30"
    >
      ⏱️ Zaman Aşımı (Süresinde Yetiştirilemedi)
      <p className="mt-1 text-xs font-normal text-rose-100/85">
        Yanıtların süre bitiminde otomatik gönderildi. Bir sonraki denemede
        soru başına süre planlamayı dene.
      </p>
    </div>
  );
}

export function ExamResultTransparencyFootnote({
  curriculum,
  engineType,
}: {
  curriculum: CurriculumCode;
  engineType: EngineType;
}): ReactNode {
  const { footnote } = getScoreTransparencyCopy(curriculum, engineType);
  return (
    <p className="mx-auto mt-4 max-w-xl text-left text-[11px] leading-relaxed text-amber-200/90">
      *{footnote}
    </p>
  );
}
