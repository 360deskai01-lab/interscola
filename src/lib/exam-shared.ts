import {
  BookOpen as BookOpenIcon,
  ListChecks as ListChecksIcon,
  PenLine as PenLineIcon,
} from 'lucide-react';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
  EvaluationResult,
} from '@/types/exam';

// ---------------------------------------------------------------------------
// Sınav modları
// ---------------------------------------------------------------------------

export interface ExamMode {
  id: string;
  curriculum: CurriculumCode;
  engineType: EngineType;
  label: string;
  tagline: string;
  description: string;
  /** Lucide ikon bileşeni. `typeof PenLine` yerine daha dar bir tip kullanılıyor. */
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  ring: string;
  subjects: readonly string[];
  defaultQuestions: number;
  maxQuestions: number;
}

export const EXAM_MODES: readonly ExamMode[] = [
  {
    id: 'ielts',
    curriculum: 'IELTS',
    engineType: 'LANGUAGE',
    label: 'IELTS Academic',
    tagline: 'Task 1 / Task 2',
    description:
      'Diagnostic Drill veya kısa yazma görevi — resmi tam IELTS oturumu değil; bant göstergesi ve kelime sayacı.',
    icon: PenLineIcon,
    accent: 'from-cyan-400 via-sky-500 to-blue-600',
    ring: 'group-hover:ring-cyan-400/50',
    subjects: ['Academic Writing Task 2'],
    defaultQuestions: 1,
    maxQuestions: 2,
  },
  {
    id: 'caie',
    curriculum: 'CAIE',
    engineType: 'RUBRIC_ESSAY',
    label: 'CAIE A-Level',
    tagline: 'RUBRIC_ESSAY',
    description:
      'Mikro alıştırma veya kısa rubrik görevi — tek oturum vaka analizi; resmi CAIE serisi değildir.',
    icon: BookOpenIcon,
    accent: 'from-violet-400 via-purple-500 to-fuchsia-600',
    ring: 'group-hover:ring-violet-400/50',
    subjects: [
      'Psychology 9990',
      'Business 9609',
      'Economics 9708',
      'Sociology 9699',
    ],
    defaultQuestions: 1,
    maxQuestions: 3,
  },
  {
    id: 'sat',
    curriculum: 'SAT',
    engineType: 'OBJECTIVE',
    label: 'Digital SAT',
    tagline: 'Drill & Mini Mock',
    description:
      'Diagnostic Drill (3–5 soru) veya Mini Deneme (10–12 soru). Resmi Bluebook tam oturumu değildir.',
    icon: ListChecksIcon,
    accent: 'from-amber-300 via-orange-500 to-rose-500',
    ring: 'group-hover:ring-amber-400/50',
    subjects: ['Reading & Writing', 'Math'],
    defaultQuestions: 4,
    maxQuestions: 12,
  },
];

// İkonlar yukarıda import edilip `EXAM_MODES` içinde referans veriliyor.

// ---------------------------------------------------------------------------
// Aşamalar
// ---------------------------------------------------------------------------

export type Phase = 'home' | 'generating' | 'exam' | 'grading' | 'results';

// ---------------------------------------------------------------------------
// Geçmiş denemeler
// ---------------------------------------------------------------------------

/** `/api/attempts` yanıtındaki tek bir kayıt. */
export interface AttemptRecord {
  id: string;
  curriculum: string;
  subject: string;
  examTitle: string | null;
  engineType: EngineType;
  rawScore: number;
  maxScore: number;
  percentage: number;
  scaledResult: string;
  metricBreakdown: Record<string, number | string>;
  studentAnswers: Record<string, string>;
  feedback: string;
  remedialTopics: string[];
  createdAt: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseAttempt(raw: unknown): AttemptRecord | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' ? raw.id : null;
  const engineType = raw.engine_type;
  if (!id) return null;
  if (
    engineType !== 'OBJECTIVE' &&
    engineType !== 'LANGUAGE' &&
    engineType !== 'RUBRIC_ESSAY'
  ) {
    return null;
  }

  const evaluations = isRecord(raw.evaluations) ? raw.evaluations : {};
  const metricBreakdown = isRecord(raw.metric_breakdown)
    ? (raw.metric_breakdown as Record<string, number | string>)
    : {};

  return {
    id,
    curriculum: typeof raw.curriculum === 'string' ? raw.curriculum : 'SAT',
    subject: typeof raw.subject === 'string' ? raw.subject : 'Sınav',
    examTitle: typeof raw.exam_title === 'string' ? raw.exam_title : null,
    engineType,
    rawScore: toNumberOr(raw.raw_score, 0),
    maxScore: toNumberOr(raw.max_score, 0),
    percentage: toNumberOr(raw.percentage, 0),
    scaledResult:
      typeof raw.scaled_result === 'string' ? raw.scaled_result : '—',
    metricBreakdown,
    studentAnswers: isRecord(raw.student_answers)
      ? (raw.student_answers as Record<string, string>)
      : {},
    feedback:
      typeof evaluations.feedback === 'string' ? evaluations.feedback : '',
    remedialTopics: Array.isArray(evaluations.remedialTopics)
      ? evaluations.remedialTopics.filter(
          (topic): topic is string => typeof topic === 'string',
        )
      : [],
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : '',
  };
}

export function parseAttemptsPayload(
  payload: unknown,
  ok: boolean,
): AttemptRecord[] {
  if (!ok || !isRecord(payload) || !Array.isArray(payload.attempts)) {
    return [];
  }
  return payload.attempts
    .map(parseAttempt)
    .filter((attempt): attempt is AttemptRecord => attempt !== null);
}

/**
 * Geçmiş kayıttan karne ekranı için yeterli AssessmentPayload üretir.
 * `ExamResults` yalnızca metadata alanlarını kullanır; sorular gerekmez.
 */
export function examFromAttempt(attempt: AttemptRecord): AssessmentPayload {
  return {
    curriculum: attempt.curriculum as CurriculumCode,
    subject: attempt.subject,
    title: attempt.examTitle ?? attempt.subject,
    engineType: attempt.engineType,
    durationMinutes: 0,
    totalMarks: attempt.maxScore,
    questions: [],
  };
}

export function evaluationFromAttempt(
  attempt: AttemptRecord,
): EvaluationResult {
  return {
    score: attempt.rawScore,
    maxScore: attempt.maxScore,
    scaledResult: attempt.scaledResult,
    metricBreakdown: attempt.metricBreakdown,
    feedback: attempt.feedback,
    remedialTopics: attempt.remedialTopics,
  };
}

/** Geçmiş listesinde motor adını okunabilir biçimde göstermek için. */
export const ENGINE_LABELS: Record<EngineType, string> = {
  OBJECTIVE: 'Digital SAT',
  LANGUAGE: 'IELTS',
  RUBRIC_ESSAY: 'CAIE',
};

export function formatAttemptDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Başarı / rozet kuralları
// ---------------------------------------------------------------------------

/** Başarı eşiği: CAIE A/A*, SAT 1350+, IELTS 7.0+ */
export function isHighScore(
  engineType: EngineType,
  evaluation: EvaluationResult,
): boolean {
  if (engineType === 'OBJECTIVE') return evaluation.score >= 1350;
  if (engineType === 'LANGUAGE') return evaluation.score >= 7;
  const grade = evaluation.scaledResult.replace(/[^A-Z*]/g, '');
  return grade === 'A' || grade === 'A*';
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  hint: string;
}

export function buildBadges(
  engineType: EngineType,
  evaluation: EvaluationResult,
  answeredEvery: boolean,
  fastFinish: boolean,
): Badge[] {
  const badges: Badge[] = [
    {
      id: 'first-flight',
      emoji: '🎯',
      label: 'First Flight',
      hint: 'İlk sınavını tamamladın.',
    },
  ];

  if (isHighScore(engineType, evaluation)) {
    badges.push({
      id: 'high-flyer',
      emoji: '🔥',
      label: 'High Flyer',
      hint: 'Hedef bandın üstünde bitirdin.',
    });
  }

  if (fastFinish) {
    badges.push({
      id: 'speed-demon',
      emoji: '⚡',
      label: 'Speed Demon',
      hint: 'Sürenin yarısından önce bitirdin.',
    });
  }

  if (answeredEvery) {
    badges.push({
      id: 'full-sweep',
      emoji: '🧭',
      label: 'Full Sweep',
      hint: 'Tek bir soruyu bile boş bırakmadın.',
    });
  }

  if (evaluation.remedialTopics.length === 0) {
    badges.push({
      id: 'flawless',
      emoji: '💎',
      label: 'Flawless',
      hint: 'Eksik kazanım kalmadı.',
    });
  }

  return badges;
}

// ---------------------------------------------------------------------------
// Biçimlendirme yardımcıları
// ---------------------------------------------------------------------------

export function formatScore(engineType: EngineType, value: number): string {
  if (engineType === 'LANGUAGE') return value.toFixed(1);
  if (engineType === 'RUBRIC_ESSAY') return Math.round(value).toString();
  return Math.round(value).toString();
}

/** API'nin döndürdüğü ham anahtarları okunabilir etiketlere çevirir. */
const METRIC_LABELS: Record<string, string> = {
  dogru: 'Doğru',
  yanlis: 'Yanlış',
  bos: 'Boş',
  dogrulukYuzdesi: 'Doğruluk',
  yuzde: 'Yüzde',
  genelBand: 'Genel Band',
  AO1: 'AO1 · Bilgi',
  AO2: 'AO2 · Uygulama',
  AO3: 'AO3 · Değerlendirme',
  mcqDogru: 'MCQ doğru',
  mcqYanlis: 'MCQ yanlış',
  mcqBos: 'MCQ boş',
  'Task Achievement': 'Task Achievement',
  'Coherence & Cohesion': 'Coherence & Cohesion',
  'Lexical Resource': 'Lexical Resource',
  'Grammatical Range': 'Grammatical Range',
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key;
}

export function metricSuffix(key: string): string {
  return key === 'dogrulukYuzdesi' || key === 'yuzde' ? '%' : '';
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Şık metnini ekranda sade gösterir: "A) Paris" -> "Paris" */
export function stripOptionLabel(option: string): string {
  return option.replace(/^\s*(?:OPTION\s*)?[A-D]\s*[).:\-]\s*/i, '').trim();
}
