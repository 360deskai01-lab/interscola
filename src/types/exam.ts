export type EngineType = 'LANGUAGE' | 'RUBRIC_ESSAY' | 'OBJECTIVE';
export type CurriculumCode = 'IELTS' | 'CAIE' | 'SAT';

export interface ExamQuestion {
  id: string;
  questionNumber: number;
  prompt: string;
  type: 'multiple_choice' | 'extended_essay' | 'structured_text';
  options?: string[]; // OBJECTIVE için zorunlu 4 şık (A, B, C, D)
  correctAnswer?: string; // OBJECTIVE ve kısa yanıtlar için doğru şık / model yanıt
  explanation?: string; // Doğru yanıtın rasyoneli
  targetMarks: number;
  rubricCriteria?: {
    ao1_knowledge?: string;
    ao2_application?: string;
    ao3_evaluation?: string;
    ielts_task_achievement?: string;
    ielts_coherence_cohesion?: string;
    ielts_lexical_resource?: string;
    ielts_grammatical_range?: string;
  };
}

export interface AssessmentPayload {
  curriculum: CurriculumCode;
  subject: string;
  title: string;
  engineType: EngineType;
  durationMinutes: number;
  totalMarks: number;
  questions: ExamQuestion[];
}

export interface EvaluationResult {
  score: number;
  maxScore: number;
  scaledResult: string; // 'Band 7.5', '1420/1600', 'Grade A*'
  metricBreakdown: Record<string, number | string>;
  feedback: string;
  remedialTopics: string[];
}
