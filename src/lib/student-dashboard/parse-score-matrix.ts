import { RIASEC_LABELS } from '@/lib/assessment/scoring';
import type {
  AssessmentKind,
  AssessmentScoreMatrix,
  BigFiveKey,
  CognitiveKey,
  RiasecCode,
} from '@/types/assessment';

const RIASEC_CODES: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];
const COGNITIVE_KEYS: CognitiveKey[] = [
  'analytical',
  'strategic',
  'focus_power',
  'relational',
];
const BIG_FIVE_KEYS: BigFiveKey[] = [
  'discipline',
  'focus',
  'stress_tolerance',
  'extraversion',
  'openness',
];

const COGNITIVE_LABELS: Record<CognitiveKey, string> = {
  analytical: 'Analitik düşünme',
  strategic: 'Stratejik planlama',
  focus_power: 'Odak gücü',
  relational: 'İlişki kurma',
};

const BIG_FIVE_LABELS: Record<BigFiveKey, string> = {
  discipline: 'Disiplin',
  focus: 'Konsantrasyon',
  stress_tolerance: 'Stres dayanımı',
  extraversion: 'Sosyallik',
  openness: 'Açıklık',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceRawScores(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Tek boyut hücresi: kayıtta `percent` veya `sum`/`max` olabilir. */
function parseScoreCell(cell: unknown): { percent: number; average: number } {
  if (!isRecord(cell)) {
    return { percent: 0, average: 0 };
  }

  const percentDirect =
    typeof cell.percent === 'number'
      ? cell.percent
      : Number(cell.percent);
  const averageDirect =
    typeof cell.average === 'number'
      ? cell.average
      : Number(cell.average);

  if (Number.isFinite(percentDirect)) {
    return {
      percent: Math.round(percentDirect),
      average: Number.isFinite(averageDirect) ? averageDirect : 0,
    };
  }

  const sum = typeof cell.sum === 'number' ? cell.sum : Number(cell.sum);
  const max = typeof cell.max === 'number' ? cell.max : Number(cell.max);
  const count =
    typeof cell.count === 'number' ? cell.count : Number(cell.count);

  if (Number.isFinite(sum) && Number.isFinite(max) && max > 0) {
    const avg =
      Number.isFinite(averageDirect) && averageDirect > 0
        ? averageDirect
        : Number.isFinite(count) && count > 0
          ? sum / count
          : 0;
    return {
      percent: Math.round((sum / max) * 100),
      average: avg,
    };
  }

  return { percent: 0, average: 0 };
}

function parseDimensionRecord<T extends string>(
  raw: unknown,
  keys: readonly T[],
): Record<T, { percent: number; average: number }> {
  const record = isRecord(raw) ? raw : {};
  const out = {} as Record<T, { percent: number; average: number }>;
  for (const key of keys) {
    out[key] = parseScoreCell(record[key]);
  }
  return out;
}

function dimensionHasSignal(
  record: Record<string, { percent: number; average: number }>,
): boolean {
  return Object.values(record).some(
    (cell) => cell.percent > 0 || cell.average > 0,
  );
}

/** Holland kodundan minimal radar (skor json bozuksa yedek). */
export function minimalAssessmentMatrixFromHolland(
  hollandCode: string,
  hollandTitle?: string | null,
): AssessmentScoreMatrix | null {
  const letters = hollandCode
    .toUpperCase()
    .split('')
    .filter((char): char is RiasecCode =>
      (RIASEC_CODES as readonly string[]).includes(char),
    );
  const uniqueTop = [...new Set(letters)].slice(0, 3) as RiasecCode[];
  if (uniqueTop.length === 0) return null;

  const riasec = {} as AssessmentScoreMatrix['riasec'];
  for (const code of RIASEC_CODES) {
    const rank = uniqueTop.indexOf(code);
    const percent = rank === 0 ? 85 : rank === 1 ? 70 : rank === 2 ? 58 : 25;
    riasec[code] = {
      sum: 0,
      count: 0,
      max: 0,
      average: percent / 20,
      percent,
    };
  }

  const emptyBigFive = parseDimensionRecord({}, BIG_FIVE_KEYS);
  const emptyCognitive = parseDimensionRecord({}, COGNITIVE_KEYS);

  const code = uniqueTop.join('');
  const title =
    hollandTitle?.trim() ||
    `${code} — ${uniqueTop.map((letter) => RIASEC_LABELS[letter]).join(' · ')}`;

  return buildMatrixFromParts(
    riasec,
    emptyBigFive,
    emptyCognitive,
    code,
    title,
    uniqueTop,
  );
}

function buildMatrixFromParts(
  riasecPartial: Record<RiasecCode, { percent: number; average: number }>,
  bigFivePartial: Record<BigFiveKey, { percent: number; average: number }>,
  cognitivePartial: Record<CognitiveKey, { percent: number; average: number }>,
  hollandCode: string,
  hollandTitle: string,
  topRiasec: RiasecCode[],
): AssessmentScoreMatrix {
  const fullRiasec = {} as AssessmentScoreMatrix['riasec'];
  for (const code of RIASEC_CODES) {
    const cell = riasecPartial[code];
    fullRiasec[code] = {
      sum: 0,
      count: 0,
      max: 0,
      average: cell.average,
      percent: cell.percent,
    };
  }

  const fullBigFive = {} as AssessmentScoreMatrix['bigFive'];
  for (const key of BIG_FIVE_KEYS) {
    const cell = bigFivePartial[key];
    fullBigFive[key] = {
      sum: 0,
      count: 0,
      max: 0,
      average: cell.average,
      percent: cell.percent,
    };
  }

  const fullCognitive = {} as AssessmentScoreMatrix['cognitive'];
  for (const key of COGNITIVE_KEYS) {
    const cell = cognitivePartial[key];
    fullCognitive[key] = {
      sum: 0,
      count: 0,
      max: 0,
      average: cell.average,
      percent: cell.percent,
    };
  }

  return {
    riasec: fullRiasec,
    bigFive: fullBigFive,
    cognitive: fullCognitive,
    hollandCode: hollandCode || topRiasec.join('') || '—',
    hollandTitle: hollandTitle || hollandCode,
    topRiasec: topRiasec.length > 0 ? topRiasec : RIASEC_CODES.slice(0, 3),
  };
}

/** Skor json içinden yalnızca Holland kodu (kısmi parse yedeği). */
export function extractHollandFromScoresRaw(raw: unknown): string | null {
  const obj = coerceRawScores(raw);
  if (!obj) return null;
  const code =
    typeof obj.hollandCode === 'string'
      ? obj.hollandCode.trim()
      : typeof obj.holland_code === 'string'
        ? obj.holland_code.trim()
        : '';
  if (!code || code === '—') return null;
  return code;
}

/** DB `scores` / legacy `score_matrix` jsonb → tip güvenli matris. */
export function parseAssessmentScoreMatrix(
  raw: unknown,
): AssessmentScoreMatrix | null {
  const obj = coerceRawScores(raw);
  if (!obj) return null;

  const riasecPartial = parseDimensionRecord(obj.riasec ?? obj.RIASEC, RIASEC_CODES);
  const bigFivePartial = parseDimensionRecord(
    obj.bigFive ?? obj.big_five ?? obj.BIG_FIVE,
    BIG_FIVE_KEYS,
  );
  const cognitivePartial = parseDimensionRecord(
    obj.cognitive ?? obj.COGNITIVE,
    COGNITIVE_KEYS,
  );

  const hollandCode =
    typeof obj.hollandCode === 'string'
      ? obj.hollandCode.trim()
      : typeof obj.holland_code === 'string'
        ? obj.holland_code.trim()
        : '';
  const hollandTitle =
    typeof obj.hollandTitle === 'string'
      ? obj.hollandTitle.trim()
      : typeof obj.holland_title === 'string'
        ? obj.holland_title.trim()
        : '';
  const topRiasec = Array.isArray(obj.topRiasec)
    ? obj.topRiasec.filter(
        (item): item is RiasecCode =>
          typeof item === 'string' &&
          (RIASEC_CODES as readonly string[]).includes(item),
      )
    : [];

  const hasSignal =
    dimensionHasSignal(riasecPartial) ||
    dimensionHasSignal(bigFivePartial) ||
    dimensionHasSignal(cognitivePartial) ||
    Boolean(hollandCode);

  if (!hasSignal) return null;

  return buildMatrixFromParts(
    riasecPartial,
    bigFivePartial,
    cognitivePartial,
    hollandCode,
    hollandTitle,
    topRiasec,
  );
}

export function extractTopStrengthTraits(
  scores: AssessmentScoreMatrix,
  limit = 5,
): string[] {
  const traits: string[] = [];

  for (const letter of scores.topRiasec.slice(0, 3)) {
    traits.push(RIASEC_LABELS[letter]);
  }

  const cognitiveRanked = [...COGNITIVE_KEYS].sort(
    (a, b) => scores.cognitive[b].percent - scores.cognitive[a].percent,
  );
  for (const key of cognitiveRanked.slice(0, 2)) {
    traits.push(COGNITIVE_LABELS[key]);
  }

  const bigFiveRanked = [...BIG_FIVE_KEYS].sort(
    (a, b) => scores.bigFive[b].percent - scores.bigFive[a].percent,
  );
  if (traits.length < limit && bigFiveRanked[0]) {
    traits.push(BIG_FIVE_LABELS[bigFiveRanked[0]]);
  }

  const seen = new Set<string>();
  return traits.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  }).slice(0, limit);
}

export const ASSESSMENT_KIND_PRIORITY: Record<AssessmentKind, number> = {
  deep_cognitive: 4,
  deep_big_five: 3,
  deep_riasec: 2,
  quick_combo: 1,
};

export function isAssessmentKind(value: string): value is AssessmentKind {
  return (
    value === 'quick_combo' ||
    value === 'deep_riasec' ||
    value === 'deep_big_five' ||
    value === 'deep_cognitive'
  );
}
