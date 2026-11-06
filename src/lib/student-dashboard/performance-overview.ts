import type { StudentAttemptAnalyticsPoint } from '@/lib/student-analytics';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import { parseCaieGradeFromScaledResult } from '@/lib/universities/caie-grade';

const CAIE_GRADE_ORDER: Record<string, number> = {
  'A*': 6,
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  U: 0,
};

function attemptRow(attempt: StudentAttemptAnalyticsPoint) {
  return {
    curriculum: attempt.curriculum,
    /** Analitik satırında ham puan yok; SAT/IELTS için scaled_result metni kullanılır. */
    raw_score: null as unknown,
    scaled_result: attempt.scaledResult,
  };
}

export interface CurriculumAttemptStats {
  count: number;
  bestDisplay: string;
  /** SAT: number /1600, IELTS: band, CAIE: null (harf). */
  bestNumeric: number | null;
  avgDisplay: string;
}

function emptyStats(label: string): CurriculumAttemptStats {
  return {
    count: 0,
    bestDisplay: label,
    bestNumeric: null,
    avgDisplay: '—',
  };
}

export function buildSatKpiStats(
  attempts: StudentAttemptAnalyticsPoint[],
): CurriculumAttemptStats {
  const rows = attempts
    .filter((a) => a.curriculum.toUpperCase() === 'SAT')
    .map((a) => ({ ...attemptRow(a), createdAt: a.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (rows.length === 0) {
    return emptyStats('— /1600');
  }
  const scores: number[] = [];
  for (const row of rows) {
    const n = parseSatScoreFromAttempt(row);
    if (n !== null) scores.push(n);
  }
  if (scores.length === 0) {
    return {
      count: rows.length,
      bestDisplay: '— /1600',
      bestNumeric: null,
      avgDisplay: '—',
    };
  }
  const best = Math.max(...scores);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return {
    count: rows.length,
    bestDisplay: `${best} /1600`,
    bestNumeric: best,
    avgDisplay: `${Math.round(avg)}`,
  };
}

export function buildIeltsKpiStats(
  attempts: StudentAttemptAnalyticsPoint[],
): CurriculumAttemptStats {
  const rows = attempts
    .filter((a) => a.curriculum.toUpperCase() === 'IELTS')
    .map((a) => ({ ...attemptRow(a), createdAt: a.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (rows.length === 0) {
    return emptyStats('— /9.0');
  }
  const bands: number[] = [];
  for (const row of rows) {
    const n = parseIeltsBandFromAttempt(row);
    if (n !== null) bands.push(n);
  }
  if (bands.length === 0) {
    return {
      count: rows.length,
      bestDisplay: '— /9.0',
      bestNumeric: null,
      avgDisplay: '—',
    };
  }
  const best = Math.max(...bands);
  const avg = bands.reduce((s, v) => s + v, 0) / bands.length;
  return {
    count: rows.length,
    bestDisplay: `${best.toFixed(1)} /9.0`,
    bestNumeric: best,
    avgDisplay: avg.toFixed(1),
  };
}

export function buildCaieKpiStats(
  attempts: StudentAttemptAnalyticsPoint[],
): CurriculumAttemptStats {
  const rows = attempts
    .filter((a) => a.curriculum.toUpperCase() === 'CAIE')
    .map((a) => ({ ...attemptRow(a), createdAt: a.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (rows.length === 0) {
    return emptyStats('A*–E');
  }
  const grades: string[] = [];
  const nums: number[] = [];
  for (const row of rows) {
    const g = parseCaieGradeFromScaledResult(row.scaled_result);
    if (g) {
      grades.push(g);
      const o = CAIE_GRADE_ORDER[g];
      if (o !== undefined) nums.push(o);
    }
  }
  if (grades.length === 0) {
    return {
      count: rows.length,
      bestDisplay: '—',
      bestNumeric: null,
      avgDisplay: '—',
    };
  }
  const bestGrade = grades.reduce((best, g) => {
    const bo = CAIE_GRADE_ORDER[best] ?? -1;
    const go = CAIE_GRADE_ORDER[g] ?? -1;
    return go > bo ? g : best;
  }, grades[0]!);
  const avg =
    nums.length > 0
      ? nums.reduce((s, v) => s + v, 0) / nums.length
      : null;
  const avgLabel =
    avg !== null
      ? avg >= 5.5
        ? '~ A/A* bandı'
        : avg >= 4
          ? '~ B bandı'
          : avg >= 3
            ? '~ C bandı'
            : '~ D–E'
      : '—';
  return {
    count: rows.length,
    bestDisplay: `Grade ${bestGrade}`,
    bestNumeric: CAIE_GRADE_ORDER[bestGrade] ?? null,
    avgDisplay: avgLabel,
  };
}

export interface MilestoneSnapshot {
  baselineLabel: string;
  latestLabel: string;
  deltaLabel: string | null;
  curriculumLabel: string;
}

function formatSat(n: number): string {
  return `${Math.round(n)} /1600`;
}

function formatIelts(n: number): string {
  return `Band ${n.toFixed(1)}`;
}

function formatCaie(grade: string): string {
  return `Grade ${grade}`;
}

/**
 * İlk ve son deneme aynı müfredatta ise anlamlı delta; aksi halde sadece yüzde farkı.
 */
export function buildMilestoneSnapshot(
  attempts: StudentAttemptAnalyticsPoint[],
): MilestoneSnapshot | null {
  if (attempts.length === 0) return null;
  const sortedAll = [...attempts].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const last = sortedAll[sortedAll.length - 1]!;
  const track = last.curriculum.toUpperCase();
  const trackAttempts = sortedAll.filter(
    (a) => a.curriculum.toUpperCase() === track,
  );
  const first = trackAttempts[0] ?? last;

  const rowFirst = attemptRow(first);
  const rowLast = attemptRow(last);

  let baselineLabel = first.scaledResult;
  let latestLabel = last.scaledResult;
  let deltaLabel: string | null = null;
  let curriculumLabel =
    track === 'SAT'
      ? 'Digital SAT'
      : track === 'IELTS'
        ? 'IELTS Academic'
        : track === 'CAIE'
          ? 'CAIE A-Level'
          : first.curriculum;

  if (track === 'SAT') {
    const b = parseSatScoreFromAttempt(rowFirst);
    const l = parseSatScoreFromAttempt(rowLast);
    if (b !== null) baselineLabel = formatSat(b);
    if (l !== null) latestLabel = formatSat(l);
    if (b !== null && l !== null && first.curriculum === last.curriculum) {
      const d = l - b;
      deltaLabel =
        d === 0
          ? 'Değişim yok'
          : `${d > 0 ? '+' : ''}${Math.round(d)} Puan (SAT)`;
    }
  } else if (track === 'IELTS') {
    const b = parseIeltsBandFromAttempt(rowFirst);
    const l = parseIeltsBandFromAttempt(rowLast);
    if (b !== null) baselineLabel = formatIelts(b);
    if (l !== null) latestLabel = formatIelts(l);
    if (b !== null && l !== null && first.curriculum === last.curriculum) {
      const d = Math.round((l - b) * 10) / 10;
      deltaLabel =
        d === 0
          ? 'Değişim yok'
          : `${d > 0 ? '+' : ''}${d.toFixed(1)} Band`;
    }
  } else if (track === 'CAIE') {
    const bg = parseCaieGradeFromScaledResult(rowFirst.scaled_result);
    const lg = parseCaieGradeFromScaledResult(rowLast.scaled_result);
    if (bg) baselineLabel = formatCaie(bg);
    if (lg) latestLabel = formatCaie(lg);
    if (
      bg &&
      lg &&
      first.curriculum === last.curriculum &&
      CAIE_GRADE_ORDER[lg] !== undefined &&
      CAIE_GRADE_ORDER[bg] !== undefined
    ) {
      const step = CAIE_GRADE_ORDER[lg]! - CAIE_GRADE_ORDER[bg]!;
      deltaLabel =
        step === 0
          ? 'Not basamağı değişmedi'
          : `${step > 0 ? '+' : ''}${step} basamak (CAIE harf notu)`;
    }
  }

  if (deltaLabel === null && first.id !== last.id && trackAttempts.length >= 2) {
    const dp = last.percentage - first.percentage;
    if (Number.isFinite(dp) && dp !== 0) {
      deltaLabel = `${dp > 0 ? '+' : ''}${Math.round(dp * 10) / 10}% başarı`;
    }
  }

  return {
    baselineLabel,
    latestLabel,
    deltaLabel,
    curriculumLabel,
  };
}
