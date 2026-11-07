/**
 * Kurum koordinatörü: `/coordinator?tab=` ↔ sol menü / içerik.
 */
export type CoordinatorDashboardTab =
  | 'overview'
  | 'codes'
  | 'students'
  | 'teachers'
  | 'branches';

export function parseCoordinatorDashboardTab(
  raw: string | null | undefined,
): CoordinatorDashboardTab {
  const tab = raw?.trim().toLowerCase() ?? '';
  if (tab === 'codes' || tab === 'code' || tab === 'invite') return 'codes';
  if (tab === 'students' || tab === 'student') return 'students';
  if (tab === 'teachers' || tab === 'teacher') return 'teachers';
  if (tab === 'branches' || tab === 'branch') return 'branches';
  if (tab === 'overview' || tab === 'dashboard' || tab === '') return 'overview';
  return 'overview';
}

export function coordinatorDashboardHref(
  tab: CoordinatorDashboardTab,
): string {
  if (tab === 'overview') return '/coordinator';
  const params = new URLSearchParams({ tab });
  return `/coordinator?${params.toString()}`;
}
