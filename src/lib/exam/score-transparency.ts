import type { CurriculumCode, EngineType } from '@/types/exam';

export interface ScoreTransparencyCopy {
  scoreHeading: string;
  footnote: string;
}

export function getScoreTransparencyCopy(
  curriculum: CurriculumCode,
  engineType: EngineType,
): ScoreTransparencyCopy {
  if (curriculum === 'SAT' || engineType === 'OBJECTIVE') {
    return {
      scoreHeading: 'Tahmini SAT Bilişsel Seviye Göstergesi (400–1600)',
      footnote:
        'Bu skor College Board Bluebook çok aşamalı adaptif modül yapısını içermez.',
    };
  }
  if (curriculum === 'IELTS' || engineType === 'LANGUAGE') {
    return {
      scoreHeading: 'IELTS Academic Band Göstergesi (Writing & Reading)',
      footnote:
        'Bu skor resmi IELTS sınavının Listening ve Speaking bileşenlerini içermez.',
    };
  }
  return {
    scoreHeading: 'Tahmini A-Level Yetkinlik Seviyesi (Grade A*–U)',
    footnote: 'Bu sonuç tek bir vaka analizi üzerinden hesaplanmıştır.',
  };
}
