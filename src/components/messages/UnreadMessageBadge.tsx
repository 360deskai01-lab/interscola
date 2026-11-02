'use client';

import type { ReactNode } from 'react';

interface UnreadMessageBadgeProps {
  count: number;
  className?: string;
  /** Tablo satırlarında daha köşeli rozet. */
  compact?: boolean;
}

export function UnreadMessageBadge({
  count,
  className = '',
  compact = false,
}: UnreadMessageBadgeProps): ReactNode {
  if (count <= 0) return null;

  const label = count > 9 ? '9+' : String(count);
  const radius = compact ? 'rounded-sm' : 'rounded-full';

  return (
    <span
      className={`inline-flex min-w-[1.1rem] items-center justify-center ${radius} bg-gradient-to-r from-rose-500 to-fuchsia-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm ${className}`}
      aria-label={`${count} yeni mesaj`}
    >
      {label}
    </span>
  );
}
