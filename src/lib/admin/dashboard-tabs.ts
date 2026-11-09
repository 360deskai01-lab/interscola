/**
 * Yönetici paneli: `/admin/dashboard?tab=` ↔ sol menü / içerik.
 * `status` searchParam geriye dönük uyumluluk için desteklenir.
 */
export type AdminDashboardTab =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'b2b'
  | 'universities'
  | 'intelligence'
  | 'audit'
  | 'all';

export function parseAdminDashboardTab(
  tabRaw: string | null | undefined,
  legacyStatusRaw?: string | null | undefined,
): AdminDashboardTab {
  const value = (tabRaw ?? legacyStatusRaw)?.trim().toLowerCase() ?? '';
  if (value === 'approved' || value === 'rejected' || value === 'pending') {
    return value;
  }
  if (value === 'b2b') return 'b2b';
  if (value === 'universities') return 'universities';
  if (value === 'intelligence') return 'intelligence';
  if (value === 'audit' || value === 'attempts') return 'audit';
  if (value === 'all') return 'all';
  return 'pending';
}

export function adminDashboardHref(tab: AdminDashboardTab): string {
  const params = new URLSearchParams({ tab });
  return `/admin/dashboard?${params.toString()}`;
}
