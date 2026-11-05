import type { ReactNode } from 'react';

export function LibraryNewBadge({ className = '' }: { className?: string }): ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ${className}`}
    >
      <span aria-hidden>✨</span>
      YENİ
    </span>
  );
}
