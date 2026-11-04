import { Play } from 'lucide-react';
import type { ReactNode } from 'react';

type FlowVideoPlaceholderProps = {
  /** Flow / harici oynatıcı entegrasyonu için slot etiketi */
  slotLabel: string;
  caption?: string;
  className?: string;
};

export function FlowVideoPlaceholder({
  slotLabel,
  caption = 'Flow video entegrasyonu için hazır alan',
  className = '',
}: FlowVideoPlaceholderProps): ReactNode {
  return (
    <div
      data-flow-video-slot="true"
      data-flow-label={slotLabel}
      className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-950/90 shadow-2xl shadow-indigo-950/30 backdrop-blur-md ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_65%)]"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid size-14 place-items-center rounded-full border border-indigo-400/35 bg-indigo-500/15 text-indigo-200">
          <Play className="size-6 fill-current" />
        </span>
        <p className="text-sm font-medium text-slate-200">{caption}</p>
        <p className="max-w-md text-xs text-slate-500">
          Slot: <span className="font-mono text-indigo-300/90">{slotLabel}</span>
        </p>
      </div>
    </div>
  );
}
