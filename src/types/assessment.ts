/** Likert: 1 = Hiç bana göre değil … 5 = Tamamen beni anlatıyor */
export type LikertValue = 1 | 2 | 3 | 4 | 5;

export type RiasecCode = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export type BigFiveKey =
  | 'discipline'
  | 'focus'
  | 'stress_tolerance'
  | 'extraversion'
  | 'openness';

export type CognitiveKey =
  | 'analytical'
  | 'strategic'
  | 'focus_power'
  | 'relational';

export type AssessmentKind =
  | 'quick_combo'
  | 'deep_riasec'
  | 'deep_big_five'
  | 'deep_cognitive';

export type QuestionDimension =
  | { family: 'riasec'; code: RiasecCode }
  | { family: 'big_five'; key: BigFiveKey }
  | { family: 'cognitive'; key: CognitiveKey };

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  dimension: QuestionDimension;
}

export interface DimensionScore {
  sum: number;
  count: number;
  max: number;
  average: number;
  percent: number;
}

export interface AssessmentScoreMatrix {
  riasec: Record<RiasecCode, DimensionScore>;
  bigFive: Record<BigFiveKey, DimensionScore>;
  cognitive: Record<CognitiveKey, DimensionScore>;
  hollandCode: string;
  hollandTitle: string;
  topRiasec: RiasecCode[];
}

export interface AssessmentAnswers {
  [questionId: string]: LikertValue;
}

export interface CareerAssessmentRecordPayload {
  kind: AssessmentKind;
  guestSessionId: string | null;
  answers: AssessmentAnswers;
  scores: AssessmentScoreMatrix;
}
