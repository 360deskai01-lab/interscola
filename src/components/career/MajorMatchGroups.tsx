import type { ReactNode } from 'react';
import type { SampleMajorSuggestion } from '@/lib/assessment/majors';

interface MajorMatchGroupsProps {
  primaryMajors: SampleMajorSuggestion[];
  secondaryMajors: SampleMajorSuggestion[];
  compact?: boolean;
}

function MajorList({
  items,
  variant,
  compact,
}: {
  items: SampleMajorSuggestion[];
  variant: 'primary' | 'secondary';
  compact?: boolean;
}): ReactNode {
  if (items.length === 0) return null;

  const border =
    variant === 'primary'
      ? 'border-emerald-400/25 bg-emerald-500/5'
      : 'border-sky-400/25 bg-sky-500/5';
  const titleColor =
    variant === 'primary' ? 'text-emerald-100' : 'text-sky-100';

  return (
    <ul className={`space-y-2 ${compact ? '' : 'mt-3'}`}>
      {items.map((major) => (
        <li
          key={major.title}
          className={`rounded-xl border ${border} ${compact ? 'p-2.5' : 'p-3.5'}`}
        >
          <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${titleColor}`}>
            {major.title}
          </p>
          {!compact ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {major.rationale}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MajorMatchGroups({
  primaryMajors,
  secondaryMajors,
  compact = false,
}: MajorMatchGroupsProps): ReactNode {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <div>
        <p className="text-xs font-semibold text-emerald-200/90">
          <span aria-hidden>🎯</span> Birincil Eşleşmeler (Doğal İlgi & Odak
          Alanları)
        </p>
        <MajorList items={primaryMajors} variant="primary" compact={compact} />
      </div>
      <div>
        <p className="text-xs font-semibold text-sky-200/90">
          <span aria-hidden>🚀</span> Geliştirilebilir & Çapraz Alanlar (Hibrit
          / Alternatif Kariyer Yolları)
        </p>
        <MajorList items={secondaryMajors} variant="secondary" compact={compact} />
      </div>
    </div>
  );
}
