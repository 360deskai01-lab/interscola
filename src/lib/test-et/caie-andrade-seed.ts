import type { AssessmentPayload } from '@/types/exam';

/** `scripts/seed-exams.ts` ile aynı sabit kimlik. */
export const CAIE_ANDRADE_SEED_LIBRARY_ID =
  'e2e00000-0000-0000-0000-000000000003';

export const CAIE_ANDRADE_LIBRARY_TITLE =
  'CAIE Psychology 9990 — Andrade Doodling Açık Teşhis Sınavı';

/** DB gecikmesi / eksik kayıt durumunda kullanılan resmi tohum payload. */
export const CAIE_ANDRADE_DIAGNOSTIC_EXAM: AssessmentPayload = {
  curriculum: 'CAIE',
  subject: 'Psychology 9990',
  title: CAIE_ANDRADE_LIBRARY_TITLE,
  engineType: 'RUBRIC_ESSAY',
  durationMinutes: 20,
  totalMarks: 20,
  questions: [
    {
      id: 'caie-andrade-mcq1',
      questionNumber: 1,
      type: 'multiple_choice',
      prompt:
        'Andrade (2010) doodling study\n\n' +
        'Which finding best summarises Andrade\'s results about doodling while ' +
        'listening to a monotonous telephone message?',
      options: [
        'A) Doodling reduced recall of both monitored and surprise items.',
        'B) Doodling improved recall of surprise items compared with a control condition.',
        'C) Doodling had no measurable effect on attention or memory.',
        'D) Doodling improved recall only when participants were highly motivated.',
      ],
      correctAnswer: 'B',
      explanation:
        'Andrade found doodling improved surprise recall versus control, suggesting ' +
        'it maintained attention on a boring task.',
      targetMarks: 2,
    },
    {
      id: 'caie-andrade-structured',
      questionNumber: 2,
      type: 'structured_text',
      prompt:
        'Outline two features of Andrade\'s (2010) methodology. [4 marks]\n\n' +
        'Write concise points; each feature should be identifiable to an examiner.',
      targetMarks: 4,
      rubricCriteria: {
        ao1_knowledge:
          'Accurate description of design features (e.g. lab experiment, IV/ DV, standardised message).',
        ao2_application:
          'Features linked explicitly to the Andrade doodling context.',
        ao3_evaluation:
          'Not required at full length; brief justification of feature relevance acceptable.',
      },
    },
    {
      id: 'caie-andrade-essay',
      questionNumber: 3,
      type: 'extended_essay',
      prompt:
        'Discuss strengths and weaknesses of laboratory experiments in psychology, ' +
        'using Andrade\'s doodling study as an example. [14 marks]\n\n' +
        'Your answer should include AO1 knowledge, AO2 application to Andrade, ' +
        'and AO3 evaluation with a reasoned conclusion.',
      targetMarks: 14,
      rubricCriteria: {
        ao1_knowledge:
          'Relevant knowledge of lab experiments (control, standardisation, replication).',
        ao2_application:
          'Application to Andrade: task, sample, measures, findings.',
        ao3_evaluation:
          'Balanced strengths/weaknesses (validity, ethics, generalisability) with judgement.',
      },
    },
  ],
};
