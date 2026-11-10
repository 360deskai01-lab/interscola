'use client';

import type { ReactNode } from 'react';

import {
  buildSafeCaieAoDisplayRows,
  resolveCambridgeGradeHeadline,
} from '@/lib/b2b/coordinator-a4-caie-ao';

const CAIE_AO_PANEL_TITLE =
  'Cambridge Assessment Objectives (AO) Dağılımı';

interface CaieAoBreakdownPanelProps {
  metricBreakdown: Record<string, number | string>;
  /** A4 yazdırma: yüksek kontrast, sayfa kesintisine dayanıklı blok */
  variant?: 'screen' | 'print';
}

export function CaieAoBreakdownPanel({
  metricBreakdown,
  variant = 'screen',
}: CaieAoBreakdownPanelProps): ReactNode {
  const rows = buildSafeCaieAoDisplayRows(metricBreakdown);
  const headline = resolveCambridgeGradeHeadline(metricBreakdown);
  const isPrint = variant === 'print';

  const rootClass = isPrint
    ? [
        'block w-full break-inside-avoid rounded-lg border-2 border-black bg-white p-4 text-black',
        'print:block print:border-black print:bg-white print:text-black',
      ].join(' ')
    : [
        'rounded-2xl border border-indigo-400/25 bg-indigo-500/[0.06] p-5',
        'print:hidden',
      ].join(' ');

  return (
    <div
      data-caie-ao-variant={variant}
      className={rootClass}
      style={
        isPrint
          ? { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }
          : undefined
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className={
            isPrint
              ? 'text-sm font-semibold text-black'
              : 'text-sm font-medium text-indigo-100'
          }
        >
          {CAIE_AO_PANEL_TITLE}
        </h3>
        <p
          className={
            isPrint
              ? 'text-sm font-bold text-black'
              : 'text-sm font-semibold text-amber-200'
          }
        >
          {headline}
        </p>
      </div>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr
            className={
              isPrint
                ? 'border-b-2 border-black text-left text-xs uppercase text-black'
                : 'border-b border-white/10 text-left text-xs uppercase text-slate-400'
            }
          >
            <th className="py-2 pr-3 font-semibold">Hedef</th>
            <th className="py-2 pr-3 text-right font-semibold">Puan</th>
            <th className="py-2 text-right font-semibold">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                isPrint
                  ? 'border-b border-black/20 break-inside-avoid'
                  : 'border-b border-white/[0.06]'
              }
            >
              <td
                className={
                  isPrint
                    ? 'py-2 pr-3 text-black'
                    : 'py-2 pr-3 text-slate-200'
                }
              >
                <span className="font-medium">
                  AO
                  {row.key === 'ao1_knowledge'
                    ? '1'
                    : row.key === 'ao2_application'
                      ? '2'
                      : '3'}
                </span>
                <span className={isPrint ? 'text-black/70' : 'text-slate-500'}>
                  {' '}
                  — {row.label}
                </span>
              </td>
              <td
                className={
                  isPrint
                    ? 'py-2 pr-3 text-right tabular-nums font-semibold text-black'
                    : 'py-2 pr-3 text-right tabular-nums font-semibold text-white'
                }
              >
                {row.pointsDisplay}
              </td>
              <td
                className={
                  isPrint
                    ? 'py-2 text-right tabular-nums text-black'
                    : 'py-2 text-right tabular-nums text-indigo-200'
                }
              >
                {row.percentDisplay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
