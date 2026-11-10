'use client';

import { Printer } from 'lucide-react';
import type { ReactNode } from 'react';

import { CaieAoBreakdownPanel } from '@/components/exam/CaieAoBreakdownPanel';
import type { AssessmentPayload, EvaluationResult } from '@/types/exam';
import { formatScore } from '@/lib/exam-shared';

const PRINT_ROOT_ID = 'interscola-exam-karne-print-root';

interface ExamKarnePrintHostProps {
  exam: AssessmentPayload;
  evaluation: EvaluationResult;
}

export function ExamKarnePrintHost({
  exam,
  evaluation,
}: ExamKarnePrintHostProps): ReactNode {
  function onPrint(): void {
    window.print();
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body * {
            visibility: hidden !important;
          }
          #${PRINT_ROOT_ID},
          #${PRINT_ROOT_ID} * {
            visibility: visible !important;
          }
          #${PRINT_ROOT_ID} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="mt-6 print:hidden">
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300/30 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white sm:w-auto"
        >
          <Printer className="size-4" aria-hidden />
          Karne yazdır / PDF
        </button>
      </div>

      <div id={PRINT_ROOT_ID} className="hidden print:block">
        <article className="mx-auto max-w-[210mm] bg-white p-6 text-black">
          <header className="border-b-2 border-black pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/70">
              Interscola · Öğrenci Karne Özeti
            </p>
            <h1 className="mt-2 text-xl font-bold text-black">
              {exam.subject} · {exam.curriculum}
            </h1>
            <p className="mt-2 text-sm text-black/80">
              Skor: {formatScore(exam.engineType, evaluation.score)} /{' '}
              {evaluation.maxScore} · {evaluation.scaledResult}
            </p>
          </header>
          <div className="mt-5 break-inside-avoid">
            <CaieAoBreakdownPanel
              variant="print"
              metricBreakdown={evaluation.metricBreakdown}
            />
          </div>
          <p className="mt-6 text-[10px] text-black/60">
            Cambridge Assessment Objectives dağılımı yalnızca bu oturum sonucunu
            yansıtır. Tarayıcı yazdır ile “PDF olarak kaydet” seçeneğini
            kullanabilirsiniz.
          </p>
        </article>
      </div>
    </>
  );
}

