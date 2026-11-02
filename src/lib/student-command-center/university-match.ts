import type {
  StudentLatestScores,
  University,
} from '@/lib/universities/types';
import {
  caieGradeMeetsALevelThreshold,
  resolveUniversityAlevelRequirement,
} from '@/lib/universities/caie-grade';

export type UniversityMatchBadge = 'met' | 'gap' | 'insufficient_data';

/**
 * Pinlenmiş kart rozeti — tanımlı barajlar ve mevcut skorlara göre özet durum.
 */
export function computeUniversityMatchBadge(
  university: University,
  scores: StudentLatestScores,
): UniversityMatchBadge {
  const minSat = university.min_sat_score;
  const minIelts = university.min_ielts_band;
  const alevelReq = resolveUniversityAlevelRequirement(university);

  const requirements: Array<'pending' | 'pass' | 'fail'> = [];

  if (minSat !== null) {
    if (scores.satScore === null) {
      requirements.push('pending');
    } else if (scores.satScore >= minSat) {
      requirements.push('pass');
    } else {
      requirements.push('fail');
    }
  }

  if (minIelts !== null) {
    if (scores.ieltsBand === null) {
      requirements.push('pending');
    } else if (scores.ieltsBand >= minIelts) {
      requirements.push('pass');
    } else {
      requirements.push('fail');
    }
  }

  if (alevelReq) {
    if (!scores.caieGrade) {
      requirements.push('pending');
    } else if (caieGradeMeetsALevelThreshold(scores.caieGrade)) {
      requirements.push('pass');
    } else {
      requirements.push('fail');
    }
  }

  if (requirements.length === 0) {
    return 'insufficient_data';
  }

  if (requirements.some((item) => item === 'fail')) {
    return 'gap';
  }

  if (requirements.some((item) => item === 'pending')) {
    return 'insufficient_data';
  }

  return 'met';
}
