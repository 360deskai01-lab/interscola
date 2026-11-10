import {
  CAIE_AO_KEYS,
  calculateCaieGrade,
  formatCaieScaledResult,
  type CaieAoKey,
} from '@/lib/exam/caie-rubric';

const AO_TR_LABELS: Record<CaieAoKey, string> = {
  ao1_knowledge: 'Bilgi ve Kavrama',
  ao2_application: 'Uygulama ve Yorum',
  ao3_evaluation: 'Analiz ve Değerlendirme',
};

const PERCENT_KEYS: Record<CaieAoKey, string> = {
  ao1_knowledge: 'ao1Percent',
  ao2_application: 'ao2Percent',
  ao3_evaluation: 'ao3Percent',
};

export type CaieMetricBreakdownSlice = {
  ao1_knowledge: number | null;
  ao2_application: number | null;
  ao3_evaluation: number | null;
  ao1Percent: number | null;
  ao2Percent: number | null;
  ao3Percent: number | null;
  cambridge_grade: string | null;
  yuzde: number | null;
};

export type CoordinatorA4CaieAoRow = {
  key: CaieAoKey;
  label: string;
  pointsDisplay: string;
  percentDisplay: string;
};

export type CoordinatorA4CaieAoSummary = {
  /** Kurumda en az bir CAIE denemesi var ve rapor bloğu gösterilir. */
  showBlock: boolean;
  attemptCount: number;
  cambridgeGradeHeadline: string;
  rows: CoordinatorA4CaieAoRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readGrade(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Tek deneme metric_breakdown → CAIE AO dilimi (eksik alanlar null). */
export function parseCaieMetricBreakdownSlice(
  breakdown: unknown,
): CaieMetricBreakdownSlice | null {
  if (!isRecord(breakdown)) return null;
  const hasAnyAo = CAIE_AO_KEYS.some(
    (key) => readFiniteNumber(breakdown[key]) !== null,
  );
  const yuzde = readFiniteNumber(breakdown.yuzde);
  const grade = readGrade(breakdown.cambridge_grade);
  if (!hasAnyAo && yuzde === null && !grade) return null;

  return {
    ao1_knowledge: readFiniteNumber(breakdown.ao1_knowledge),
    ao2_application: readFiniteNumber(breakdown.ao2_application),
    ao3_evaluation: readFiniteNumber(breakdown.ao3_evaluation),
    ao1Percent: readFiniteNumber(breakdown.ao1Percent),
    ao2Percent: readFiniteNumber(breakdown.ao2Percent),
    ao3Percent: readFiniteNumber(breakdown.ao3Percent),
    cambridge_grade: grade,
    yuzde,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function displayPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return Number.isInteger(value) ? String(value) : round1(value).toFixed(1);
}

function displayPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${round1(value)}%`;
}

/**
 * Kurumsal A4: CAIE denemelerinden ortalama AO dağılımı ve Cambridge başlığı.
 */
export function aggregateCoordinatorA4CaieAo(
  slices: CaieMetricBreakdownSlice[],
): CoordinatorA4CaieAoSummary {
  const emptyRows: CoordinatorA4CaieAoRow[] = CAIE_AO_KEYS.map((key) => ({
    key,
    label: AO_TR_LABELS[key],
    pointsDisplay: '—',
    percentDisplay: '—',
  }));

  if (slices.length === 0) {
    return {
      showBlock: false,
      attemptCount: 0,
      cambridgeGradeHeadline: '—',
      rows: emptyRows,
    };
  }

  const avgYuzde = average(
    slices
      .map((s) => s.yuzde)
      .filter((v): v is number => v !== null),
  );

  const headline =
    avgYuzde !== null
      ? formatCaieScaledResult(
          calculateCaieGrade(avgYuzde, 100),
          avgYuzde,
        )
      : '—';

  const rows: CoordinatorA4CaieAoRow[] = CAIE_AO_KEYS.map((key) => {
    const pointAvg = average(
      slices
        .map((s) => s[key])
        .filter((v): v is number => v !== null),
    );
    const percentKey = PERCENT_KEYS[key] as keyof CaieMetricBreakdownSlice;
    const percentAvg = average(
      slices
        .map((s) => s[percentKey])
        .filter((v): v is number => v !== null),
    );
    return {
      key,
      label: AO_TR_LABELS[key],
      pointsDisplay: displayPoints(pointAvg),
      percentDisplay: displayPercent(percentAvg),
    };
  });

  return {
    showBlock: true,
    attemptCount: slices.length,
    cambridgeGradeHeadline: headline,
    rows,
  };
}

/** Eksik / boş AO alanlarında güvenli gösterim satırı (audit & UI sözleşmesi). */
export function buildSafeCaieAoDisplayRows(
  breakdown: Record<string, unknown> | null | undefined,
): CoordinatorA4CaieAoRow[] {
  const slice = parseCaieMetricBreakdownSlice(breakdown ?? null);
  return CAIE_AO_KEYS.map((key) => {
    const points =
      slice && slice[key] !== null ? displayPoints(slice[key]) : '—';
    const percentKey = PERCENT_KEYS[key] as keyof CaieMetricBreakdownSlice;
    const pct =
      slice && slice[percentKey] !== null
        ? displayPercent(slice[percentKey] as number)
        : '—';
    return {
      key,
      label: AO_TR_LABELS[key],
      pointsDisplay: points,
      percentDisplay: pct,
    };
  });
}

export function resolveCambridgeGradeHeadline(
  breakdown: Record<string, unknown> | null | undefined,
): string {
  const slice = parseCaieMetricBreakdownSlice(breakdown ?? null);
  if (!slice) return '—';
  if (slice.yuzde !== null && slice.cambridge_grade) {
    return formatCaieScaledResult(slice.cambridge_grade, slice.yuzde);
  }
  if (slice.yuzde !== null) {
    return formatCaieScaledResult(
      calculateCaieGrade(slice.yuzde, 100),
      slice.yuzde,
    );
  }
  if (slice.cambridge_grade) {
    return `Grade ${slice.cambridge_grade}`;
  }
  return '—';
}
