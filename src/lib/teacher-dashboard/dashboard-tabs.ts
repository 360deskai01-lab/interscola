/**
 * Öğretmen paneli: `/teacher/dashboard?tab=` ↔ sol menü / içerik.
 */
export type TeacherDashboardTab =
  | 'overview'
  | 'students'
  | 'library'
  | 'assignments'
  | 'messages';

export function parseTeacherDashboardTab(
  raw: string | null | undefined,
): TeacherDashboardTab {
  const tab = raw?.trim().toLowerCase() ?? '';
  if (tab === 'students') return 'students';
  if (tab === 'library') return 'library';
  if (tab === 'assignments' || tab === 'progress') return 'assignments';
  if (tab === 'messages') return 'messages';
  if (tab === 'overview' || tab === 'dashboard') return 'overview';
  return 'overview';
}

export function teacherDashboardHref(tab: TeacherDashboardTab): string {
  if (tab === 'overview') return '/teacher/dashboard';
  const params = new URLSearchParams({ tab });
  return `/teacher/dashboard?${params.toString()}`;
}
