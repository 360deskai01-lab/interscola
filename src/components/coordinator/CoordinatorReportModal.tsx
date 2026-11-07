'use client';

import { Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  CoordinatorBranchSummary,
  CoordinatorOrganizationSummary,
  CoordinatorOrgPerformanceMetrics,
} from '@/lib/b2b/coordinator-types';
import { computeCoordinatorReportSeal } from '@/lib/b2b/coordinator-export';

export interface CoordinatorReportModalProps {
  open: boolean;
  onClose: () => void;
  organization: CoordinatorOrganizationSummary;
  branches: CoordinatorBranchSummary[];
  branchSummaryLabel: string;
  licenseBadgeLabel: string;
  performance: CoordinatorOrgPerformanceMetrics;
  coordinatorName: string;
}

function formatReportDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function quotaLine(org: CoordinatorOrganizationSummary): string {
  const parts: string[] = [];
  if (org.licenseType?.trim()) {
    parts.push(org.licenseType.replace(/_/g, ' '));
  }
  if (org.studentQuota != null && org.studentQuota > 0) {
    parts.push(`${org.studentQuota} koltuk`);
  } else if (org.seatsUsed > 0) {
    parts.push(`${org.seatsUsed} aktif öğrenci`);
  }
  if (org.isQuotaFull) {
    parts.push('kota dolu');
  }
  return parts.length > 0 ? parts.join(' · ') : 'Standart lisans';
}

export function CoordinatorReportModal({
  open,
  onClose,
  organization,
  branches,
  branchSummaryLabel,
  licenseBadgeLabel,
  performance,
  coordinatorName,
}: CoordinatorReportModalProps): ReactNode {
  const issuedAt = useMemo(() => new Date(), [open]);
  const issuedAtIso = issuedAt.toISOString();
  const [seal, setSeal] = useState('…');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void computeCoordinatorReportSeal(organization.id, issuedAtIso).then((code) => {
      if (!cancelled) setSeal(code);
    });
    return () => {
      cancelled = true;
    };
  }, [open, organization.id, issuedAtIso]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handlePrint() {
    window.print();
  }

  const satAvg =
    performance.avgSatScore !== null ? String(performance.avgSatScore) : '—';
  const satMax =
    performance.maxSatScore !== null ? String(performance.maxSatScore) : '—';
  const ieltsAvg =
    performance.avgIeltsBand !== null
      ? performance.avgIeltsBand.toFixed(1)
      : '—';

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #coordinator-report-print-root,
          #coordinator-report-print-root * {
            visibility: visible !important;
          }
          #coordinator-report-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 14mm;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex flex-col bg-slate-950/85 backdrop-blur-sm print:static print:bg-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinator-report-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3 print:hidden">
          <p className="text-sm font-medium text-slate-200">
            Kurumsal başarı raporu önizlemesi
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-50 hover:bg-indigo-500/30"
            >
              <Printer className="size-4" aria-hidden />
              <span aria-hidden>🖨️ </span>
              Yazdır / PDF olarak kaydet
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/[0.08]"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8 print:overflow-visible print:p-0">
          <div
            id="coordinator-report-print-root"
            className="mx-auto max-w-[210mm] rounded-xl border border-white/10 bg-white text-slate-900 shadow-2xl print:max-w-none print:rounded-none print:border-0 print:shadow-none"
          >
            <header className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 px-8 py-6 print:bg-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                    Interscola Kurumsal Rapor
                  </p>
                  <h1
                    id="coordinator-report-title"
                    className="mt-2 text-2xl font-bold text-slate-900"
                  >
                    {organization.name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Şube özeti: {branchSummaryLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Rapor tarihi: {formatReportDate(issuedAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Koordinatör: {coordinatorName}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-indigo-800/30 px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-900">
                    Doğrulama mührü
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-indigo-950">
                    {seal}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">interscola.com</p>
                </div>
              </div>
            </header>

            <div className="space-y-8 px-8 py-8">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Lisans & kota
                </h2>
                <p className="mt-2 text-lg font-medium text-slate-900">
                  {licenseBadgeLabel}
                  <span className="text-base font-normal text-slate-600">
                    {' '}
                    — {quotaLine(organization)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Durum:{' '}
                  {organization.isActive
                    ? 'Aktif kurumsal lisans'
                    : 'Lisans pasif — yönetici ile iletişim gerekir'}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Başarı radarı
                </h2>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-4 font-semibold">Metrik</th>
                      <th className="py-2 font-semibold">Değer</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4">Kurum SAT ortalaması</td>
                      <td className="py-2.5 font-medium tabular-nums">
                        {satAvg}
                        {satAvg !== '—' ? ' /1600' : ''}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4">En yüksek SAT</td>
                      <td className="py-2.5 font-medium tabular-nums">
                        {satMax}
                        {satMax !== '—' ? ' /1600' : ''}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 pr-4">IELTS band ortalaması</td>
                      <td className="py-2.5 font-medium tabular-nums">
                        {ieltsAvg}
                        {ieltsAvg !== '—' ? ' /9.0' : ''}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4">
                        Toplam çözülen deneme hacmi
                      </td>
                      <td className="py-2.5 font-medium tabular-nums">
                        {performance.totalCompletedAttempts}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Şube dağılım özeti
                </h2>
                {branches.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Tanımlı şube yok; öğretmen ve öğrenciler merkez kuruma
                    bağlı olabilir.
                  </p>
                ) : (
                  <table className="mt-3 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="py-2 pr-4 font-semibold">Şube</th>
                        <th className="py-2 pr-4 font-semibold">Şehir</th>
                        <th className="py-2 pr-4 font-semibold text-right">
                          Öğretmen
                        </th>
                        <th className="py-2 font-semibold text-right">
                          Öğrenci
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b border-slate-100 text-slate-800"
                        >
                          <td className="py-2.5 pr-4 font-medium">{b.name}</td>
                          <td className="py-2.5 pr-4 text-slate-600">
                            {b.city?.trim() || '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {b.activeTeacherCount}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {b.activeStudentCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <footer className="border-t border-slate-200 pt-4 text-[11px] text-slate-500">
                Bu belge Interscola koordinatör paneli üzerinden üretilmiştir.
                Mühür kodu kurum ve rapor günü ile deterministik olarak
                türetilmiştir; resmi arşiv için PDF olarak kaydedin.
              </footer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
