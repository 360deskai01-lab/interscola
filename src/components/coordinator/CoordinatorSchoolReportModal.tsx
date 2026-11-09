'use client';

import { Loader2, Printer, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { getCoordinatorSchoolReportDataAction } from '@/app/coordinator/coordinator-report-actions';
import type { CoordinatorSchoolReportData } from '@/app/coordinator/coordinator-report-types';
import { CoordinatorSchoolA4Report } from '@/components/coordinator/CoordinatorSchoolA4Report';

const PRINT_ROOT_ID = 'coordinator-school-a4-report';

export interface CoordinatorSchoolReportModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}

export function CoordinatorSchoolReportModal({
  open,
  onClose,
  organizationId,
}: CoordinatorSchoolReportModalProps): ReactNode {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CoordinatorSchoolReportData | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    void getCoordinatorSchoolReportDataAction({ organizationId }).then(
      (result) => {
        if (cancelled) return;
        setLoading(false);
        if (!result.success || !result.data) {
          setError(result.error ?? 'Rapor oluşturulamadı.');
          return;
        }
        setReport(result.data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

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

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #${PRINT_ROOT_ID},
          #${PRINT_ROOT_ID} * {
            visibility: visible !important;
          }
          #${PRINT_ROOT_ID} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[110] flex flex-col bg-slate-950/90 backdrop-blur-sm print:static print:bg-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinator-school-report-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3 print:hidden">
          <p
            id="coordinator-school-report-title"
            className="text-sm font-medium text-slate-200"
          >
            Kurumsal karne (A4) önizlemesi
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!report || loading}
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-50 hover:bg-indigo-500/30 disabled:opacity-40"
            >
              <Printer className="size-4" aria-hidden />
              Yazdır / PDF
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
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Kurumsal karne hazırlanıyor…
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mx-auto max-w-lg rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </div>
          ) : null}
          {report ? (
            <div className="rounded-xl border border-white/10 shadow-2xl print:border-0 print:shadow-none">
              <CoordinatorSchoolA4Report
                report={report}
                printRootId={PRINT_ROOT_ID}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
