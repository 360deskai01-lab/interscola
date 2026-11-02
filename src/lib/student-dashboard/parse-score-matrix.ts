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

function parseDimensionRecord<T extends string>(
  raw: unknown,
  keys: readonly T[],
): Record<T, { percent: number; average: number }> | null {
  if (!isRecord(raw)) return null;
  const out = {} as Record<T, { percent: number; average: number }>;
  for (const key of keys) {
    const cell = raw[key];
    if (!isRecord(cell)) return null;
    const percent =
      typeof cell.percent === 'number' ? cell.percent : Number(cell.percent);
    const average =
      typeof cell.average === 'number' ? cell.average : Number(cell.average);
    out[key] = {
      percent: Number.isFinite(percent) ? percent : 0,
      average: Number.isFinite(average) ? average : 0,
    };
  }
  return out;
}

/** DB `scores` / legacy `score_matrix` jsonb → tip güvenli matris (kısmi veride null). */
export function parseAssessmentScoreMatrix(
  raw: unknown,
): AssessmentScoreMatrix | null {
  if (!isRecord(raw)) return null;

  const riasecPartial = parseDimensionRecord(raw.riasec, RIASEC_CODES);
  const bigFivePartial = parseDimensionRecord(raw.bigFive, BIG_FIVE_KEYS);
  const cognitivePartial = parseDimensionRecord(raw.cognitive, COGNITIVE_KEYS);
  if (!riasecPartial || !bigFivePartial || !cognitivePartial) {
    return null;
  }

  const hollandCode =
    typeof raw.hollandCode === 'string' ? raw.hollandCode.trim() : '';
  const hollandTitle =
    typeof raw.hollandTitle === 'string' ? raw.hollandTitle.trim() : '';
  const topRiasec = Array.isArray(raw.topRiasec)
    ? raw.topRiasec.filter(
        (item): item is RiasecCode =>
          typeof item === 'string' &&
          (RIASEC_CODES as readonly string[]).includes(item),
      )
    : [];

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
