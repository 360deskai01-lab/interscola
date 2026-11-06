import type { ReactNode } from 'react';

export const FOUNDATION_BADGE_LABEL = 'Foundation (Hazırlık) Köprüsü Mevcut';

export const FOUNDATION_GAP_NOTE =
  'Doğrudan kabul barajının altındasınız; ancak bu kurumda 1 yıllık hazırlık programı seçeneği vardır.';

/** `has_foundation_pathway = true` olan kurumlar için rozet. */
export function FoundationPathwayBadge({
  university,
  compact = false,
}: {
  university: { has_foundation_pathway?: boolean };
  compact?: boolean;
}): ReactNode {
  if (!university.has_foundation_pathway) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-teal-400/40 bg-gradient-to-r from-teal-500/15 to-emerald-500/10 font-medium text-teal-100 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
    >
      <span aria-hidden>🎓</span>
      {FOUNDATION_BADGE_LABEL}
    </span>
  );
}
