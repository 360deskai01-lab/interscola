import { suggestTieredMajors, type SampleMajorSuggestion } from '@/lib/assessment/majors';
import {
  bigFiveRadarSeries,
  cognitiveRadarSeries,
  radarSeriesHasSignal,
  riasecRadarSeries,
  type RadarPoint,
} from '@/lib/assessment/radar-series';
import {
  CAREER_COMPASS_STAGE_ORDER,
  type CareerCompassStageId,
} from '@/lib/career-assessment/progress';
import type { AssessmentScoreMatrix, RiasecCode } from '@/types/assessment';

const RIASEC_CODES: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export type CareerInventoryFamilyId = 'riasec' | 'big_five' | 'cognitive';

export interface CareerInventoryTopDimension {
  label: string;
  percent: number;
}

export interface CareerInventoryCardModel {
  id: CareerInventoryFamilyId;
  title: string;
  subtitle: string;
  completed: boolean;
  radarData: RadarPoint[];
  topDimensions: CareerInventoryTopDimension[];
  missingCtaLabel: string;
  missingDepthHint: string;
}

export interface HybridCareerSynthesis {
  primaryMajors: SampleMajorSuggestion[];
  secondaryMajors: SampleMajorSuggestion[];
}

export interface CareerInventoryTriadBundle {
  cards: CareerInventoryCardModel[];
  synthesis: HybridCareerSynthesis;
  completedStageCount: number;
  totalStages: number;
  progressPercent: number;
}

function deriveTopRiasec(scores: AssessmentScoreMatrix): RiasecCode[] {
  const ranked = [...RIASEC_CODES].sort(
    (a, b) => scores.riasec[b].percent - scores.riasec[a].percent,
  );
  const fromMatrix = ranked.filter((code) => scores.riasec[code].percent > 0);
  if (fromMatrix.length >= 3) return fromMatrix.slice(0, 3);
  if (scores.topRiasec.length >= 3) return scores.topRiasec.slice(0, 3);
  return ranked.slice(0, 3);
}

function topDimensionsFromRadar(
  series: RadarPoint[],
  limit = 2,
): CareerInventoryTopDimension[] {
  return [...series]
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((point) => ({ label: point.axis, percent: point.value }));
}

function isRiasecComplete(
  completedStages: Set<CareerCompassStageId>,
  series: RadarPoint[],
): boolean {
  return completedStages.has('quick_combo') || radarSeriesHasSignal(series);
}

function isBigFiveComplete(
  completedStages: Set<CareerCompassStageId>,
  series: RadarPoint[],
): boolean {
  return completedStages.has('deep_big_five') || radarSeriesHasSignal(series);
}

function isCognitiveComplete(
  completedStages: Set<CareerCompassStageId>,
  series: RadarPoint[],
): boolean {
  return completedStages.has('deep_cognitive') || radarSeriesHasSignal(series);
}

function missingDepthHint(completedCount: number): string {
  const remaining = CAREER_COMPASS_STAGE_ORDER.length - completedCount;
  if (remaining <= 0) return 'Tam derinlik';
  const bump = Math.round((1 / CAREER_COMPASS_STAGE_ORDER.length) * 100);
  return `+${bump}% derinlik`;
}

/** Kümülatif matristen 360° çekirdek + hibrit bölüm önerileri. */
export function buildHybridCareerSynthesis(
  scores: AssessmentScoreMatrix,
): HybridCareerSynthesis {
  const topRiasec = deriveTopRiasec(scores);
  const tiered = suggestTieredMajors(topRiasec);

  const cognitiveRanked = cognitiveRadarSeries(scores)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);

  const secondary = [...tiered.secondaryMajors];
  const seen = new Set(secondary.map((m) => m.title));

  if (cognitiveRanked[0] && cognitiveRanked[0].value >= 55) {
    const boost: SampleMajorSuggestion = {
      title: `${cognitiveRanked[0].axis} odaklı disiplinler arası program`,
      rationale: `Bilişsel profilinizde ${cognitiveRanked[0].axis} (${cognitiveRanked[0].value}%) öne çıkıyor; çapraz rotalar için güçlü ikincil sinyal.`,
    };
    if (!seen.has(boost.title)) {
      secondary.unshift(boost);
      seen.add(boost.title);
    }
  }

  const bigFiveTop = bigFiveRadarSeries(scores)
    .sort((a, b) => b.value - a.value)[0];
  if (bigFiveTop && bigFiveTop.value >= 60 && secondary.length < 3) {
    const personalityBoost: SampleMajorSuggestion = {
      title: 'Disiplinler arası liderlik & proje tabanlı bölümler',
      rationale: `${bigFiveTop.axis} (${bigFiveTop.value}%) kişilik sinyali; hibrit ekiplerde sorumluluk alabileceğiniz alternatif yollar.`,
    };
    if (!seen.has(personalityBoost.title)) {
      secondary.push(personalityBoost);
      seen.add(personalityBoost.title);
    }
  }

  return {
    primaryMajors: tiered.primaryMajors.slice(0, 3),
    secondaryMajors: secondary.slice(0, 3),
  };
}

export function buildCareerInventoryTriad(
  scores: AssessmentScoreMatrix,
  completedStages: Set<CareerCompassStageId>,
): CareerInventoryTriadBundle {
  const riasecData = riasecRadarSeries(scores);
  const bigFiveData = bigFiveRadarSeries(scores);
  const cognitiveData = cognitiveRadarSeries(scores);

  let completedStageCount = 0;
  for (const stage of CAREER_COMPASS_STAGE_ORDER) {
    if (completedStages.has(stage)) completedStageCount += 1;
  }
  const totalStages = CAREER_COMPASS_STAGE_ORDER.length;
  const progressPercent = Math.round((completedStageCount / totalStages) * 100);
  const depthHint = missingDepthHint(completedStageCount);

  const cards: CareerInventoryCardModel[] = [
    {
      id: 'riasec',
      title: 'Holland RIASEC',
      subtitle: 'Mesleki ilgi refleksleri',
      completed: isRiasecComplete(completedStages, riasecData),
      radarData: riasecData,
      topDimensions: topDimensionsFromRadar(riasecData),
      missingCtaLabel: 'Testi Tamamla',
      missingDepthHint: depthHint,
    },
    {
      id: 'big_five',
      title: 'Big Five',
      subtitle: 'Kişilik & çalışma stili',
      completed: isBigFiveComplete(completedStages, bigFiveData),
      radarData: bigFiveData,
      topDimensions: topDimensionsFromRadar(bigFiveData),
      missingCtaLabel: 'Testi Tamamla',
      missingDepthHint: depthHint,
    },
    {
      id: 'cognitive',
      title: 'Bilişsel güçler',
      subtitle: 'VIA / düşünme tarzı',
      completed: isCognitiveComplete(completedStages, cognitiveData),
      radarData: cognitiveData,
      topDimensions: topDimensionsFromRadar(cognitiveData),
      missingCtaLabel: 'Testi Tamamla',
      missingDepthHint: depthHint,
    },
  ];

  return {
    cards,
    synthesis: buildHybridCareerSynthesis(scores),
    completedStageCount,
    totalStages,
    progressPercent,
  };
}
