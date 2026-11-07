import { countWords } from '@/lib/exam-shared';
import type {
  GuestDiagnosticQuestionBreakdown,
  GuestDiagnosticRecord,
  GuestDiagnosticRubricLine,
} from '@/lib/test-et/guest-diagnostic-storage';
import type { TestEtSlug } from '@/lib/test-et/test-et-config';
import type { AssessmentPayload, CurriculumCode, ExamQuestion } from '@/types/exam';

function normalizeMcqAnswer(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase().slice(0, 1);
}

function isMcqCorrect(question: ExamQuestion, answer: string | undefined): boolean {
  const selected = normalizeMcqAnswer(answer);
  const expected = normalizeMcqAnswer(question.correctAnswer);
  return selected.length > 0 && selected === expected;
}

function satScoreFromRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(800 + clamped * 800);
}

function estimateIeltsBand(words: number, hasStructure: boolean): number {
  let band = 5.0;
  if (words >= 120) band = 6.0;
  if (words >= 180) band = 6.5;
  if (words >= 250) band = 7.0;
  if (words >= 320) band = 7.5;
  if (hasStructure && words >= 200) band += 0.5;
  return Math.min(8.5, Math.round(band * 2) / 2);
}

function caieGradeFromPoints(earned: number, max: number): string {
  const ratio = max > 0 ? earned / max : 0;
  if (ratio >= 0.85) return 'Grade A*';
  if (ratio >= 0.72) return 'Grade A';
  if (ratio >= 0.58) return 'Grade B';
  if (ratio >= 0.45) return 'Grade C';
  return 'Grade D';
}

function buildQuestionBreakdown(
  exam: AssessmentPayload,
  answers: Record<string, string>,
): GuestDiagnosticQuestionBreakdown[] {
  return exam.questions.map((question) => {
    const answer = answers[question.id];
    const trimmed = (answer ?? '').trim();
    if (question.type === 'multiple_choice') {
      const correct = isMcqCorrect(question, answer);
      return {
        questionId: question.id,
        questionNumber: question.questionNumber,
        label: `Soru ${question.questionNumber} · Çoktan seçmeli`,
        status: correct ? 'correct' : trimmed ? 'incorrect' : 'answered',
      };
    }
    const words = countWords(trimmed);
    const status =
      words >= 80 ? 'partial' : trimmed.length > 0 ? 'answered' : 'incorrect';
    return {
      questionId: question.id,
      questionNumber: question.questionNumber,
      label: `Soru ${question.questionNumber} · Açık uçlu (${words} kelime)`,
      status,
    };
  });
}

function buildWeakTopics(
  curriculum: CurriculumCode,
  breakdown: GuestDiagnosticQuestionBreakdown[],
): string[] {
  if (curriculum === 'SAT') {
    return breakdown.some((item) => item.status === 'incorrect')
      ? ['Cebir denklemleri', 'Craft & Structure okuma']
      : ['Zaman yönetimi — tam deneme seti'];
  }
  if (curriculum === 'IELTS') {
    return [
      'Task Achievement derinliği',
      'Coherence & cohesion geçişleri',
      'Akademik kelime çeşitliliği',
    ];
  }
  return [
    'AO1 — Andrade metodoloji bilgisi',
    'AO2 — Bulgu uygulaması',
    'AO3 — Laboratuvar deneyi değerlendirmesi',
  ];
}

function buildRubricTeaser(
  curriculum: CurriculumCode,
  exam: AssessmentPayload,
  answers: Record<string, string>,
): GuestDiagnosticRubricLine[] {
  if (curriculum === 'IELTS') {
    const essay = exam.questions.find((q) => q.type === 'extended_essay');
    const words = countWords(answers[essay?.id ?? ''] ?? '');
    const band = estimateIeltsBand(words, words >= 200);
    return [
      { key: 'ta', label: 'Task Achievement', score: `~${band}` },
      { key: 'cc', label: 'Coherence & Cohesion', score: `~${Math.max(5.5, band - 0.5)}` },
      { key: 'lr', label: 'Lexical Resource', score: `~${band}` },
      { key: 'gra', label: 'Grammatical Range', score: `~${Math.max(5.5, band - 0.5)}` },
    ];
  }

  if (curriculum === 'CAIE') {
    return [
      { key: 'ao1', label: 'AO1 Knowledge', score: '12/20' },
      { key: 'ao2', label: 'AO2 Application', score: '10/20' },
      { key: 'ao3', label: 'AO3 Evaluation', score: '11/20' },
    ];
  }

  return exam.questions.map((q) => ({
    key: q.id,
    label: `Soru ${q.questionNumber}`,
    score: isMcqCorrect(q, answers[q.id]) ? '✓' : '—',
  }));
}

export function scoreGuestDiagnostic(params: {
  exam: AssessmentPayload;
  answers: Record<string, string>;
  slug: TestEtSlug;
  is_timed_out?: boolean;
}): GuestDiagnosticRecord {
  const { exam, answers, slug, is_timed_out = false } = params;
  const curriculum = exam.curriculum;
  const breakdown = buildQuestionBreakdown(exam, answers);

  let headlineScore = '';
  let summary = '';

  if (curriculum === 'SAT') {
    const mcq = exam.questions.filter((q) => q.type === 'multiple_choice');
    const correct = mcq.filter((q) => isMcqCorrect(q, answers[q.id])).length;
    const ratio = mcq.length > 0 ? correct / mcq.length : 0;
    const projected = satScoreFromRatio(ratio);
    headlineScore = `${projected} / 1600`;
    summary =
      correct === mcq.length
        ? 'Kısa teşhis setinde güçlü bir taban — tam adaptif deneme ile netleştirin.'
        : 'Temel seviye görünür; hedeflediğiniz bölüm pratiği ile hızlı kazanım mümkün.';
  } else if (curriculum === 'IELTS') {
    const essay = exam.questions.find((q) => q.type === 'extended_essay');
    const text = answers[essay?.id ?? ''] ?? '';
    const words = countWords(text);
    const band = estimateIeltsBand(words, text.includes('\n') || text.length > 400);
    headlineScore = `Band ${band.toFixed(1)}`;
    summary =
      words >= 250
        ? 'Task 2 hacmi iyi — rubrik detayları hesabınızda açılır.'
        : 'Yanıt iskeleti oluşuyor — tam rubrik geri bildirimi için kayıt önerilir.';
  } else {
    let earned = 0;
    let max = 0;
    for (const question of exam.questions) {
      max += question.targetMarks;
      if (question.type === 'multiple_choice') {
        if (isMcqCorrect(question, answers[question.id])) {
          earned += question.targetMarks;
        }
      } else {
        const words = countWords(answers[question.id] ?? '');
        if (words >= 40) earned += Math.round(question.targetMarks * 0.55);
        else if (words >= 15) earned += Math.round(question.targetMarks * 0.35);
      }
    }
    headlineScore = caieGradeFromPoints(earned, max);
    summary =
      'AO1/AO2/AO3 dağılımınız hesaplandı — eksik kazanım raporu hesabınızda.';
  }

  return {
    curriculum,
    slug,
    completedAt: new Date().toISOString(),
    headlineScore,
    summary,
    answers,
    is_timed_out,
    lockedTeaser: {
      questionBreakdown: breakdown,
      rubricBreakdown: buildRubricTeaser(curriculum, exam, answers),
      weakTopics: buildWeakTopics(curriculum, breakdown),
    },
  };
}
