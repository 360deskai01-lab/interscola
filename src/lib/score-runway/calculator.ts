export interface CalculateScoreRunwayParams {
  baselineScore: number;
  targetScore: number;
  currentScore: number;
  /** ISO tarih (YYYY-MM-DD). */
  examDate: string;
  /** Test ve deterministik hesap için (varsayılan: bugün UTC). */
  referenceDate?: string;
}

export interface ScoreRunwayCalculation {
  monthsRemaining: number;
  monthlyPace: number;
  currentMonthTarget: number;
  monthIndex: number;
  progressPercent: number;
  pointsRemainingToMonthlyTarget: number;
  isMilestoneUnlocked: boolean;
}

function parseYmd(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  const y = Number.parseInt(match[1]!, 10);
  const m = Number.parseInt(match[2]!, 10) - 1;
  const d = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return { y, m, d };
}

function todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthAnchorYmd(parts: { y: number; m: number }): string {
  const m = String(parts.m + 1).padStart(2, '0');
  return `${parts.y}-${m}-01`;
}

/** Takvim ayı farkı (başlangıç ayı dahil, bitiş − başlangıç). */
function calendarMonthsBetween(startYmd: string, endYmd: string): number {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (!start || !end) return 0;
  return (end.y - start.y) * 12 + (end.m - start.m);
}

function numericTolerance(target: number): number {
  return target <= 9.5 ? 0.05 : 0.5;
}

/**
 * Başlangıç → hedef mesafesini sınav tarihine kalan aylara böler;
 * içinde bulunulan ayın sprint hedefini ve ilerlemeyi üretir.
 */
export function calculateScoreRunway(
  params: CalculateScoreRunwayParams,
): ScoreRunwayCalculation | null {
  const { baselineScore, targetScore, currentScore, examDate } = params;
  const refYmd = (params.referenceDate ?? todayYmdUtc()).slice(0, 10);
  const examYmd = examDate.slice(0, 10);

  if (
    !Number.isFinite(baselineScore) ||
    !Number.isFinite(targetScore) ||
    !Number.isFinite(currentScore)
  ) {
    return null;
  }

  const refParts = parseYmd(refYmd);
  const examParts = parseYmd(examYmd);
  if (!refParts || !examParts) return null;

  const refAnchor = monthAnchorYmd(refParts);
  const examAnchor = monthAnchorYmd(examParts);

  if (calendarMonthsBetween(refAnchor, examAnchor) < 0) {
    return null;
  }

  let monthsRemaining = calendarMonthsBetween(refAnchor, examAnchor);
  if (monthsRemaining <= 0) monthsRemaining = 1;

  const monthIndex = Math.max(
    1,
    Math.min(monthsRemaining, calendarMonthsBetween(refAnchor, refYmd) + 1),
  );

  const monthlyPace = (targetScore - baselineScore) / monthsRemaining;
  const rawMonthTarget = baselineScore + monthlyPace * monthIndex;
  const currentMonthTarget = Math.min(targetScore, rawMonthTarget);

  const tol = numericTolerance(targetScore);
  const pointsRemainingToMonthlyTarget = Math.max(
    0,
    currentMonthTarget - currentScore,
  );

  const span = currentMonthTarget - baselineScore;
  let progressPercent = 0;
  if (currentScore >= targetScore) {
    progressPercent = 100;
  } else if (span <= 0) {
    progressPercent = currentScore >= currentMonthTarget ? 100 : 0;
  } else {
    progressPercent = Math.min(
      100,
      Math.max(0, ((currentScore - baselineScore) / span) * 100),
    );
  }

  const isMilestoneUnlocked =
    currentScore >= targetScore - tol ||
    currentScore >= currentMonthTarget - tol;

  return {
    monthsRemaining,
    monthlyPace,
    currentMonthTarget,
    monthIndex,
    progressPercent,
    pointsRemainingToMonthlyTarget,
    isMilestoneUnlocked,
  };
}
