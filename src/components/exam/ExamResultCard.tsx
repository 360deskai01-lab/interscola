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
