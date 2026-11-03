import type { AssessmentScoreMatrix, RiasecCode } from '@/types/assessment';

const RIASEC_CODES: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

function pickRicher(
  a: { percent: number; average: number },
  b: { percent: number; average: number },
): { percent: number; average: number } {
  return b.percent >= a.percent ? b : a;
}

/** Birden fazla tamamlanan testten tek kümülatif profil (boyut bazında en güçlü sinyal). */
export function mergeAssessmentScoreMatrices(
  matrices: AssessmentScoreMatrix[],
): AssessmentScoreMatrix | null {
  if (matrices.length === 0) return null;

  const base = matrices[0]!;
  const merged: AssessmentScoreMatrix = structuredClone(base);

  for (let i = 1; i < matrices.length; i += 1) {
    const next = matrices[i]!;
    for (const code of RIASEC_CODES) {
      merged.riasec[code] = {
        ...merged.riasec[code],
        ...pickRicher(merged.riasec[code], next.riasec[code]),
      };
    }
    for (const key of Object.keys(merged.bigFive) as (keyof AssessmentScoreMatrix['bigFive'])[]) {
      merged.bigFive[key] = {
        ...merged.bigFive[key],
        ...pickRicher(merged.bigFive[key], next.bigFive[key]),
      };
    }
    for (const key of Object.keys(merged.cognitive) as (keyof AssessmentScoreMatrix['cognitive'])[]) {
      merged.cognitive[key] = {
        ...merged.cognitive[key],
        ...pickRicher(merged.cognitive[key], next.cognitive[key]),
      };
    }
    if (next.hollandCode && next.hollandCode !== '—') {
      merged.hollandCode = next.hollandCode;
      merged.hollandTitle = next.hollandTitle;
      merged.topRiasec = [...next.topRiasec];
    }
  }

  return merged;
}
