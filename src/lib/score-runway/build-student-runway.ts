import type { StudentAnalyticsData } from '@/lib/student-analytics';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import { parseTargetNumber } from '@/lib/student-command-center/score-gap';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import type { OfficialExamRadarData } from '@/types/exam-radar';
import {
  calculateScoreRunway,
  type ScoreRunwayCalculation,
} from '@/lib/score-runway/calculator';

export type ScoreRunwayTrack = 'SAT' | 'IELTS';

export interface StudentScoreRunwayViewModel {
  track: ScoreRunwayTrack;
  trackLabel: string;
  unit: string;
  baselineScore: number;
  targetScore: number;
  currentScore: number;
  examDate: string;
  calculation: ScoreRunwayCalculation;
}

const TRACK_ORDER: ScoreRunwayTrack[] = ['SAT', 'IELTS'];

function parseScoreFromAttempt(
  track: ScoreRunwayTrack,
  scaledResult: string,
): number | null {
  const row = {
    raw_score: null as unknown,
    scaled_result: scaledResult,
  };
  return track === 'SAT'
    ? parseSatScoreFromAttempt(row)
    : parseIeltsBandFromAttempt(row);
}

function earliestBaseline(
  attempts: StudentAnalyticsData['attempts'],
  track: ScoreRunwayTrack,
): number | null {
  const rows = attempts
    .filter((a) => a.curriculum.toUpperCase() === track)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of rows) {
    const score = parseScoreFromAttempt(track, row.scaledResult);
    if (score !== null) return score;
  }
  return null;
}

function formatScore(track: ScoreRunwayTrack, value: number): string {
  return track === 'SAT' ? String(Math.round(value)) : value.toFixed(1);
}

export function buildStudentScoreRunway(input: {
  commandCenter: StudentCommandCenterData;
  analytics: StudentAnalyticsData;
  examRadar: OfficialExamRadarData;
  curriculums: string[];
}): StudentScoreRunwayViewModel | null {
  const examDate = input.examRadar.nearestExam?.examDate?.slice(0, 10);
  if (!examDate) return null;

  const goals = input.commandCenter.goals;
  const { recentScores } = input.commandCenter;
  const curriculumSet = new Set(
    input.curriculums.map((c) => c.toUpperCase()),
  );

  for (const track of TRACK_ORDER) {
    if (!curriculumSet.has(track)) continue;

    const target = parseTargetNumber(goals.targetScores[track]);
    if (target === null) continue;

    const current =
      track === 'SAT' ? recentScores.satScore : recentScores.ieltsBand;
    if (current === null) continue;

    let baseline = earliestBaseline(input.analytics.attempts, track);
    if (baseline === null) {
      baseline = Math.min(current, target);
    }
    if (baseline >= target) {
      baseline = Math.max(0, target - (track === 'SAT' ? 120 : 0.5));
    }

    const calculation = calculateScoreRunway({
      baselineScore: baseline,
      targetScore: target,
      currentScore: current,
      examDate,
    });
    if (!calculation) continue;

    return {
      track,
      trackLabel: track === 'SAT' ? 'Digital SAT' : 'IELTS Academic',
      unit: track === 'SAT' ? 'puan' : 'band',
      baselineScore: baseline,
      targetScore: target,
      currentScore: current,
      examDate,
      calculation,
    };
  }

  return null;
}

export { formatScore as formatScoreRunwayValue };
