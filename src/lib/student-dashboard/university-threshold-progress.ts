import { scoreGapProgress } from '@/lib/student-command-center/score-gap';
import type { StudentLatestScores, University } from '@/lib/universities/types';

export interface ExamThresholdProgress {
  required: number | null;
  best: number | null;
  percent: number;
  remaining: number | null;
  met: boolean;
  summaryLabel: string;
}

export interface UniversityThresholdProgress {
  universityId: string;
  name: string;
  slug: string;
  country: string;
  city: string | null;
  sat: ExamThresholdProgress;
  ielts: ExamThresholdProgress;
}

function buildExamProgress(
  required: number | null,
  best: number | null,
  unit: 'puan' | 'band',
  format: (n: number) => string,
): ExamThresholdProgress {
  if (required === null) {
    return {
      required: null,
      best,
      percent: 0,
      remaining: null,
      met: false,
      summaryLabel: 'Baraj tanımlı değil',
    };
  }

  const { percent, remaining, exceeded } = scoreGapProgress(best, required);
  const met = exceeded;

  let summaryLabel: string;
  if (best === null) {
    summaryLabel = `Baraj ${format(required)} ${unit} — henüz deneme yok`;
  } else if (met) {
    summaryLabel = `Baraj karşılandı (${format(best)} ${unit})`;
  } else if (remaining !== null) {
    summaryLabel =
      unit === 'puan'
        ? `Baraja ${Math.round(remaining)} puan kaldı (%${percent} tamamlandı)`
        : `Baraja +${remaining.toFixed(1)} band kaldı (%${percent} tamamlandı)`;
  } else {
    summaryLabel = '—';
  }

  return {
    required,
    best,
    percent: met ? 100 : percent,
    remaining: met ? 0 : remaining,
    met,
    summaryLabel,
  };
}

export function buildUniversityThresholdProgressList(
  universities: University[],
  matchScores: StudentLatestScores,
): UniversityThresholdProgress[] {
  return universities.map((university) => ({
    universityId: university.id,
    name: university.name,
    slug: university.slug,
    country: university.country,
    city: university.city,
    sat: buildExamProgress(
      university.min_sat_score,
      matchScores.satScore,
      'puan',
      (n) => String(Math.round(n)),
    ),
    ielts: buildExamProgress(
      university.min_ielts_band,
      matchScores.ieltsBand,
      'band',
      (n) => n.toFixed(1),
    ),
  }));
}
