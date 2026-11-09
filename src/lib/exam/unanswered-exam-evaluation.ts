import type { AssessmentPayload, EvaluationResult } from '@/types/exam';

const SAT_MAX_SCORE = 1600;
const IELTS_MIN_BAND = 1;
const IELTS_MAX_BAND = 9;

const AO_LABELS = {
  ao1_knowledge: 'AO1',
  ao2_application: 'AO2',
  ao3_evaluation: 'AO3',
} as const;

const IELTS_LABELS = {
  ielts_task_achievement: 'Task Achievement',
  ielts_coherence_cohesion: 'Coherence & Cohesion',
  ielts_lexical_resource: 'Lexical Resource',
  ielts_grammatical_range: 'Grammatical Range',
} as const;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Tüm sorular boş / süre dolumu — Gemini çağrısı olmadan deterministik sıfır karne.
 */
export function evaluationForUnansweredExam(
  exam: AssessmentPayload,
): EvaluationResult {
  const remedialTopics = exam.questions.map(
    (question) =>
      `Soru ${question.questionNumber} yanıtsız — süre doldu veya boş bırakıldı. ${truncate(question.prompt, 80)}`,
  );
  const feedback =
    'Hiçbir soruya yanıt verilmedi. Ham puan 0 (%0) olarak kaydedildi; ' +
    'bir sonraki denemede süre planlamayı ve ilk sorulara erken başlamayı dene.';

  if (exam.engineType === 'OBJECTIVE') {
    const mcqCount = exam.questions.filter(
      (question) => question.type === 'multiple_choice',
    ).length;
    return {
      score: 0,
      maxScore: SAT_MAX_SCORE,
      scaledResult: `0 / ${SAT_MAX_SCORE}`,
      metricBreakdown: {
        dogru: 0,
        yanlis: 0,
        bos: mcqCount > 0 ? mcqCount : exam.questions.length,
        dogrulukYuzdesi: 0,
      },
      feedback,
      remedialTopics,
    };
  }

  if (exam.engineType === 'RUBRIC_ESSAY' || exam.curriculum === 'CAIE') {
    const mcqCount = exam.questions.filter(
      (question) => question.type === 'multiple_choice',
    ).length;
    return {
      score: 0,
      maxScore: exam.totalMarks,
      scaledResult: 'Grade U',
      metricBreakdown: {
        [AO_LABELS.ao1_knowledge]: 0,
        [AO_LABELS.ao2_application]: 0,
        [AO_LABELS.ao3_evaluation]: 0,
        yuzde: 0,
        ...(mcqCount > 0
          ? { mcqDogru: 0, mcqYanlis: 0, mcqBos: mcqCount }
          : {}),
      },
      feedback,
      remedialTopics,
    };
  }

  const metricBreakdown: Record<string, number> = {
    genelBand: IELTS_MIN_BAND,
    yuzde: 0,
  };
  for (const label of Object.values(IELTS_LABELS)) {
    metricBreakdown[label] = IELTS_MIN_BAND;
  }

  return {
    score: IELTS_MIN_BAND,
    maxScore: IELTS_MAX_BAND,
    scaledResult: `Band ${IELTS_MIN_BAND.toFixed(1)}`,
    metricBreakdown,
    feedback,
    remedialTopics,
  };
}
