import type { StudentAnalyticsData } from '@/lib/student-analytics';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import { parseTargetNumber } from '@/lib/student-command-center/score-gap';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import { resolveTrackExamDateYmd } from '@/lib/exam-radar/load-exam-radar';
import type { OfficialExamRadarData } from '@/types/exam-radar';
import type { StudentRecentScores } from '@/lib/student-command-center/attempt-scores';
import {
  calculateScoreRunway,
  type ScoreRunwayCalculation,
} from '@/lib/score-runway/calculator';

export type ScoreRunwayTrack = 'SAT' | 'IELTS';

export interface StudentScoreRunwayViewModel {
  track: ScoreRunwayTrack;
  trackLabel: string;
  tabEmoji: string;
  unit: string;
  baselineScore: number;
  targetScore: number;
  currentScore: number;
  examDate: string;
  calculation: ScoreRunwayCalculation;
  baselineSource: 'profile' | 'diagnostic' | 'first_attempt' | 'default';
}

export interface StudentScoreRunwayBundle {
  runwayList: StudentScoreRunwayViewModel[];
  runways: Record<ScoreRunwayTrack, StudentScoreRunwayViewModel | null>;
  defaultTrack: ScoreRunwayTrack | null;
}

const TRACK_ORDER: ScoreRunwayTrack[] = ['SAT', 'IELTS'];

const TRACK_META: Record<
  ScoreRunwayTrack,
  { label: string; tabEmoji: string; unit: string }
> = {
  SAT: { label: 'Digital SAT', tabEmoji: '🏛️', unit: 'puan' },
  IELTS: { label: 'IELTS Academic', tabEmoji: '🌍', unit: 'band' },
};

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

function isDiagnosticDrillTitle(examTitle: string): boolean {
  const t = examTitle.toLowerCase();
  return (
    t.includes('diagnostic drill') ||
    t.includes('mikro alıştırma') ||
    (t.includes('mikro') && t.includes('drill'))
  );
}

function parseManualBaselineFromProfile(
  targetScores: StudentCommandCenterData['goals']['targetScores'],
  track: ScoreRunwayTrack,
): number | null {
  return parseTargetNumber(targetScores[`${track}_baseline`]);
}

function trackAttemptsSorted(
  attempts: StudentAnalyticsData['attempts'],
  track: ScoreRunwayTrack,
) {
  return attempts
    .filter((a) => a.curriculum.toUpperCase() === track)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function scoreFromFirstMatching(
  rows: StudentAnalyticsData['attempts'],
  track: ScoreRunwayTrack,
  predicate: (row: (typeof rows)[number]) => boolean,
): number | null {
  for (const row of rows) {
    if (!predicate(row)) continue;
    const score = parseScoreFromAttempt(track, row.scaledResult);
    if (score !== null) return score;
  }
  return null;
}

function safeDefaultBaseline(
  track: ScoreRunwayTrack,
  current: number,
  target: number,
): number {
  let baseline = Math.min(current, target);
  if (baseline >= target) {
    baseline = Math.max(0, target - (track === 'SAT' ? 120 : 0.5));
  }
  return baseline;
}

function resolveBaselineForTrack(input: {
  attempts: StudentAnalyticsData['attempts'];
  track: ScoreRunwayTrack;
  manualBaseline: number | null;
  current: number;
  target: number;
}): { value: number; source: StudentScoreRunwayViewModel['baselineSource'] } {
  if (input.manualBaseline !== null) {
    return { value: input.manualBaseline, source: 'profile' };
  }

  const rows = trackAttemptsSorted(input.attempts, input.track);

  const diagnostic = scoreFromFirstMatching(
    rows,
    input.track,
    (row) => isDiagnosticDrillTitle(row.examTitle),
  );
  if (diagnostic !== null) {
    return { value: diagnostic, source: 'diagnostic' };
  }

  const firstOfficial = scoreFromFirstMatching(
    rows,
    input.track,
    (row) => !isDiagnosticDrillTitle(row.examTitle),
  );
  if (firstOfficial !== null) {
    return { value: firstOfficial, source: 'first_attempt' };
  }

  const anyAttempt = scoreFromFirstMatching(rows, input.track, () => true);
  if (anyAttempt !== null) {
    return { value: anyAttempt, source: 'first_attempt' };
  }

  return {
    value: safeDefaultBaseline(input.track, input.current, input.target),
    source: 'default',
  };
}

function resolveTargetForTrack(
  track: ScoreRunwayTrack,
  goals: StudentCommandCenterData['goals'],
  current: number,
): number {
  const fromProfile = parseTargetNumber(goals.targetScores[track]);
  if (fromProfile !== null) return fromProfile;

  if (track === 'SAT') {
    return Math.min(1600, Math.max(1200, Math.round(current) + 150));
  }
  return Math.min(9, Math.max(5.5, Math.round((current + 1) * 10) / 10));
}

function normalizeActiveTracks(
  curriculums: string[],
  goals: StudentCommandCenterData['goals'],
  recentScores: StudentRecentScores,
): ScoreRunwayTrack[] {
  const wanted = new Set<ScoreRunwayTrack>();

  for (const raw of curriculums) {
    const code = raw.toUpperCase();
    if (code === 'SAT' || code === 'IELTS') wanted.add(code);
  }

  for (const key of Object.keys(goals.targetScores)) {
    const upper = key.toUpperCase();
    if (upper === 'SAT' || upper === 'IELTS') wanted.add(upper);
  }

  if (recentScores.satScore !== null) wanted.add('SAT');
  if (recentScores.ieltsBand !== null) wanted.add('IELTS');

  return TRACK_ORDER.filter((t) => wanted.has(t));
}

function buildRunwayForTrack(
  input: {
    commandCenter: StudentCommandCenterData;
    analytics: StudentAnalyticsData;
    examDate: string;
  },
  track: ScoreRunwayTrack,
): StudentScoreRunwayViewModel | null {
  const goals = input.commandCenter.goals;
  const { recentScores } = input.commandCenter;

  const current =
    track === 'SAT' ? recentScores.satScore : recentScores.ieltsBand;
  if (current === null) return null;

  const target = resolveTargetForTrack(track, goals, current);

  const manualBaseline = parseManualBaselineFromProfile(goals.targetScores, track);
  const { value: baseline, source } = resolveBaselineForTrack({
    attempts: input.analytics.attempts,
    track,
    manualBaseline,
    current,
    target,
  });

  let adjustedBaseline = baseline;
  if (adjustedBaseline >= target) {
    adjustedBaseline = safeDefaultBaseline(track, current, target);
  }

  const calculation = calculateScoreRunway({
    baselineScore: adjustedBaseline,
    targetScore: target,
    currentScore: current,
    examDate: input.examDate,
  });
  if (!calculation) return null;

  const meta = TRACK_META[track];
  return {
    track,
    trackLabel: meta.label,
    tabEmoji: meta.tabEmoji,
    unit: meta.unit,
    baselineScore: adjustedBaseline,
    targetScore: target,
    currentScore: current,
    examDate: input.examDate,
    calculation,
    baselineSource: source,
  };
}

export function buildStudentScoreRunways(input: {
  commandCenter: StudentCommandCenterData;
  analytics: StudentAnalyticsData;
  examRadar: OfficialExamRadarData;
  curriculums: string[];
}): StudentScoreRunwayBundle {
  const runwayList: StudentScoreRunwayViewModel[] = [];
  const runways: Record<ScoreRunwayTrack, StudentScoreRunwayViewModel | null> = {
    SAT: null,
    IELTS: null,
  };

  const tracks = normalizeActiveTracks(
    input.curriculums,
    input.commandCenter.goals,
    input.commandCenter.recentScores,
  );
  const nearestExam = input.examRadar.nearestExam;

  for (const track of tracks) {
    const examDate = resolveTrackExamDateYmd(track, nearestExam);
    const runway = buildRunwayForTrack(
      {
        commandCenter: input.commandCenter,
        analytics: input.analytics,
        examDate,
      },
      track,
    );
    if (!runway) continue;
    runways[track] = runway;
    runwayList.push(runway);
  }

  return {
    runwayList,
    runways,
    defaultTrack: runwayList[0]?.track ?? null,
  };
}

/** Geriye dönük: ilk hesaplanan pist (öncelik SAT → IELTS). */
export function buildStudentScoreRunway(input: {
  commandCenter: StudentCommandCenterData;
  analytics: StudentAnalyticsData;
  examRadar: OfficialExamRadarData;
  curriculums: string[];
}): StudentScoreRunwayViewModel | null {
  return buildStudentScoreRunways(input).runwayList[0] ?? null;
}

function formatScore(track: ScoreRunwayTrack, value: number): string {
  return track === 'SAT' ? String(Math.round(value)) : value.toFixed(1);
}

export { formatScore as formatScoreRunwayValue };
