import type {
  AssessmentAnswers,
  AssessmentQuestion,
  AssessmentScoreMatrix,
  BigFiveKey,
  CognitiveKey,
  DimensionScore,
  LikertValue,
  RiasecCode,
} from '@/types/assessment';

const RIASEC_CODES: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

const BIG_FIVE_KEYS: BigFiveKey[] = [
  'discipline',
  'focus',
  'stress_tolerance',
  'extraversion',
  'openness',
];

const COGNITIVE_KEYS: CognitiveKey[] = [
  'analytical',
  'strategic',
  'focus_power',
  'relational',
];

const RIASEC_LABELS: Record<RiasecCode, string> = {
  R: 'Gerçekçi',
  I: 'Araştırmacı',
  A: 'Sanatsal',
  S: 'Sosyal',
  E: 'Girişimci',
  C: 'Düzenli',
};

const HOLLAND_NICKNAMES: Record<string, string> = {
  ISA: 'Araştırmacı & Vizyoner',
  IEC: 'Analitik Lider',
  AIS: 'Yaratıcı İletişimci',
  SEC: 'Organize Etkileyici',
  RIC: 'Pratik Çözümcü',
  EAS: 'Girişimci Yaratıcı',
};

function emptyBucket(): Record<string, { sum: number; count: number }> {
  return {};
}

function addAnswer(
  buckets: Record<string, { sum: number; count: number }>,
  key: string,
  value: LikertValue,
): void {
  const current = buckets[key] ?? { sum: 0, count: 0 };
  current.sum += value;
  current.count += 1;
  buckets[key] = current;
}

function finalizeDimension(
  sum: number,
  count: number,
): DimensionScore {
  const max = count * 5;
  const average = count > 0 ? sum / count : 0;
  const percent = max > 0 ? Math.round((sum / max) * 100) : 0;
  return { sum, count, max, average, percent };
}

function buildDimensionRecord<T extends string>(
  keys: readonly T[],
  buckets: Record<string, { sum: number; count: number }>,
): Record<T, DimensionScore> {
  const out = {} as Record<T, DimensionScore>;
  for (const key of keys) {
    const bucket = buckets[key] ?? { sum: 0, count: 0 };
    out[key] = finalizeDimension(bucket.sum, bucket.count);
  }
  return out;
}

function deriveHollandCode(
  riasec: Record<RiasecCode, DimensionScore>,
): { code: string; title: string; top: RiasecCode[] } {
  const ranked = [...RIASEC_CODES].sort(
    (a, b) => riasec[b].percent - riasec[a].percent,
  );
  const top = ranked.slice(0, 3);
  const code = top.join('');
  const nickname = HOLLAND_NICKNAMES[code];
  const title = nickname
    ? `${code} — ${nickname}`
    : `${code} — ${top.map((letter) => RIASEC_LABELS[letter]).join(' · ')}`;
  return { code, title, top };
}

/** Deterministik puanlama — LLM kullanılmaz. */
export function calculateScores(
  questions: AssessmentQuestion[],
  answers: AssessmentAnswers,
): AssessmentScoreMatrix {
  const riasecBuckets = emptyBucket();
  const bigFiveBuckets = emptyBucket();
  const cognitiveBuckets = emptyBucket();

  for (const question of questions) {
    const raw = answers[question.id];
    if (raw === undefined) continue;
    const value = Math.min(5, Math.max(1, Math.round(raw))) as LikertValue;

    if (question.dimension.family === 'riasec') {
      addAnswer(riasecBuckets, question.dimension.code, value);
    } else if (question.dimension.family === 'big_five') {
      addAnswer(bigFiveBuckets, question.dimension.key, value);
    } else {
      addAnswer(cognitiveBuckets, question.dimension.key, value);
    }
  }

  const riasec = buildDimensionRecord(RIASEC_CODES, riasecBuckets);
  const bigFive = buildDimensionRecord(BIG_FIVE_KEYS, bigFiveBuckets);
  const cognitive = buildDimensionRecord(COGNITIVE_KEYS, cognitiveBuckets);
  const holland = deriveHollandCode(riasec);

  return {
    riasec,
    bigFive,
    cognitive,
    hollandCode: holland.code,
    hollandTitle: holland.title,
    topRiasec: holland.top,
  };
}

export function riasecRadarData(
  scores: AssessmentScoreMatrix,
): { axis: string; value: number; letter: RiasecCode }[] {
  return RIASEC_CODES.map((letter) => ({
    letter,
    axis: RIASEC_LABELS[letter],
    value: scores.riasec[letter].percent,
  }));
}

export { RIASEC_LABELS };
