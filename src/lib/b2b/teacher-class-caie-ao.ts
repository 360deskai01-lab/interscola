import {
  aggregateBranchCaieAo,
  parseCaieMetricBreakdownSlice,
  type CoordinatorA4CaieAoSummary,
} from '@/lib/b2b/coordinator-a4-caie-ao';
import { loadReportAttemptRowsForStudents } from '@/lib/b2b/coordinator-school-report-analytics';

export { aggregateBranchCaieAo };

/**
 * Öğretmenin bağlı öğrencilerinin tamamlanmış CAIE denemelerinden şube AO ortalaması.
 */
export async function buildTeacherClassCaieAoSummary(
  studentUserIds: string[],
): Promise<CoordinatorA4CaieAoSummary> {
  if (studentUserIds.length === 0) {
    return aggregateBranchCaieAo([]);
  }

  const rows = await loadReportAttemptRowsForStudents(studentUserIds);
  const slices = [];

  for (const row of rows) {
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';
    if (curriculum !== 'CAIE') continue;
    const slice = parseCaieMetricBreakdownSlice(row.metric_breakdown);
    if (slice) slices.push(slice);
  }

  return aggregateBranchCaieAo(slices);
}
