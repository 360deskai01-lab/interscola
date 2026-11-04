export const SOLUTION_TAB_IDS = [
  'ogrenci',
  'ogretmen',
  'kurum',
  'universite',
  'burs',
] as const;

export type SolutionTabId = (typeof SOLUTION_TAB_IDS)[number];

export function isSolutionTabId(value: string): value is SolutionTabId {
  return (SOLUTION_TAB_IDS as readonly string[]).includes(value);
}

export function parseSolutionTab(raw: string | null | undefined): SolutionTabId {
  const normalized = raw?.trim().toLowerCase() ?? '';
  if (isSolutionTabId(normalized)) return normalized;
  return 'ogrenci';
}

export function solutionsTabHref(tab: SolutionTabId): string {
  return `/solutions?tab=${tab}`;
}
