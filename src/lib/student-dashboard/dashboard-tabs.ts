export type StudentDashboardTab =
  | 'cockpit'
  | 'explore'
  | 'career'
  | 'transcript'
  | 'portfolio'
  | 'assignments'
  | 'messages';

/** URL `?tab=` ↔ sidebar sekmesi (geriye dönük: `inbox` → ödevler). */
export function parseStudentDashboardTab(
  raw: string | null | undefined,
): StudentDashboardTab {
  const tab = raw?.trim().toLowerCase() ?? '';
  if (tab === 'explore') return 'explore';
  if (tab === 'inbox' || tab === 'assignments') return 'assignments';
  if (tab === 'career') return 'career';
  if (tab === 'messages') return 'messages';
  if (tab === 'transcript') return 'transcript';
  if (tab === 'portfolio') return 'portfolio';
  if (tab === 'cockpit') return 'cockpit';
  return 'cockpit';
}

export function studentDashboardTabToSearchParam(
  tab: StudentDashboardTab,
): string | null {
  if (tab === 'cockpit') return null;
  if (tab === 'assignments') return 'inbox';
  return tab;
}
