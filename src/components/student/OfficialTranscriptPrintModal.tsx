'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Printer, X } from 'lucide-react';
import type { AcademicTranscriptData } from '@/lib/student-transcript/types';
import { GRADE_LEVELS } from '@/lib/student-transcript/types';
import {
  buildPrintRowsForYear,
  gradeLevelEnglishLabel,
} from '@/lib/student-transcript/print-rows';
import { computeTranscriptVerificationCode } from '@/lib/student-transcript/verification-code';

export interface TranscriptStudentIdentity {
  fullName: string;
  studentId: string;
  graduationTrack: string;
}

interface OfficialTranscriptPrintModalProps {
  open: boolean;
  onClose: () => void;
  transcript: AcademicTranscriptData;
  identity: TranscriptStudentIdentity;
}

function formatIssueDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function OfficialTranscriptPrintModal({
  open,
  onClose,
  transcript,
  identity,
}: OfficialTranscriptPrintModalProps): ReactNode {
  const [verificationCode, setVerificationCode] = useState<string>('…');

  const issueDate = useMemo(
    () => formatIssueDate(transcript.updatedAt),
    [transcript.updatedAt],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void computeTranscriptVerificationCode(identity.studentId, transcript).then(
      (code) => {
        if (!cancelled) setVerificationCode(code);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, identity.studentId, transcript]);

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
          #official-transcript-print-root,
          #official-transcript-print-root * {
            visibility: visible !important;
          }
          #official-transcript-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex flex-col bg-slate-950/85 backdrop-blur-sm print:static print:bg-white print:p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-transcript-title"
      >
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-white/10 px-4 py-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <Printer className="size-4" />
            Yazdır / PDF Kaydet
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15"
          >
            <X className="size-4" />
            Kapat
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 print:overflow-visible print:p-0">
          <div
            id="official-transcript-print-root"
            className="mx-auto w-[210mm] bg-white text-black shadow-2xl print:shadow-none"
          >
            <article className="min-h-[297mm] px-[14mm] py-[12mm] text-[11px] leading-snug print:px-0 print:py-0">
              <header className="border-b-2 border-slate-800 pb-4">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-600 uppercase">
                  Interscola Academic Assessment Network
                </p>
                <h1
                  id="official-transcript-title"
                  className="mt-2 text-base font-bold tracking-tight text-slate-900 uppercase"
                >
                  Official High School Academic Record
                </h1>
              </header>

              <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
                <MetaRow label="Student Full Name" value={identity.fullName} />
                <MetaRow
                  label="Student ID / Unique System ID"
                  value={identity.studentId}
                />
                <MetaRow
                  label="Graduation Track"
                  value={identity.graduationTrack || 'General Secondary'}
                />
                <MetaRow label="Issue Date" value={issueDate} />
              </section>

              {GRADE_LEVELS.map((grade) => {
                const year = transcript.years[grade];
                const { rows, yearAverage } = buildPrintRowsForYear(year);
                if (rows.length === 0) return null;

                return (
                  <section key={grade} className="mt-6 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-400 pb-1">
                      <h2 className="text-xs font-bold text-slate-900 uppercase">
                        {gradeLevelEnglishLabel(grade)}
                      </h2>
                      {yearAverage !== null ? (
                        <p className="text-[10px] text-slate-700">
                          Year average (100-scale):{' '}
                          <span className="font-semibold tabular-nums">
                            {yearAverage.toFixed(2)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <table className="mt-2 w-full border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-left text-[9px] font-semibold text-slate-700 uppercase">
                          <th className="py-1.5 pr-2">Course Title</th>
                          <th className="w-16 py-1.5 pr-2 text-right">
                            Hrs/Wk
                          </th>
                          <th className="w-20 py-1.5 pr-2 text-right">
                            Grade (100)
                          </th>
                          <th className="w-14 py-1.5 pr-2 text-center">
                            US Ltr
                          </th>
                          <th className="w-14 py-1.5 text-right">GPA Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr
                            key={`${grade}-${index}`}
                            className="border-b border-slate-200"
                          >
                            <td className="py-1.5 pr-2">{row.courseTitle}</td>
                            <td className="py-1.5 pr-2 text-right tabular-nums">
                              {row.weeklyHours > 0 ? row.weeklyHours : '—'}
                            </td>
                            <td className="py-1.5 pr-2 text-right tabular-nums">
                              {row.numericGrade.toFixed(2)}
                            </td>
                            <td className="py-1.5 pr-2 text-center font-medium">
                              {row.usLetter}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">
                              {row.gradePoints.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}

              <section className="mt-8 break-inside-avoid rounded border border-slate-300 bg-slate-50 p-3">
                <h2 className="text-[10px] font-bold text-slate-900 uppercase">
                  Academic Summary
                </h2>
                <div className="mt-2 grid grid-cols-3 gap-3 text-[10px]">
                  <div>
                    <p className="text-slate-600">Cumulative GPA (4.0 Scale)</p>
                    <p className="text-sm font-bold tabular-nums">
                      {transcript.gpa4Scale.toFixed(2)} / 4.00
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Weighted Percentage</p>
                    <p className="text-sm font-bold tabular-nums">
                      {transcript.cumulative100.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Composite Letter Grade</p>
                    <p className="text-sm font-bold">
                      {transcript.wesEquivalentGrade}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-300 pt-2 text-[9px] text-slate-700">
                  <p className="font-semibold uppercase">
                    WES Conversion Scale Reference
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    <li>85–100 → A / 4.0</li>
                    <li>70–84.99 → B / 3.0</li>
                    <li>60–69.99 → C / 2.0</li>
                    <li>50–59.99 → D / 1.0</li>
                    <li>Below 50 → F / 0.0</li>
                  </ul>
                </div>
              </section>

              <footer className="mt-10 break-inside-avoid border-t-2 border-slate-800 pt-4 text-[9px] text-slate-700">
                <p className="font-semibold text-slate-900">
                  Official Academic Record — Valid with institutional digital
                  verification
                </p>
                <p className="mt-2 font-mono text-[10px] tracking-wide text-slate-900">
                  Verification Code: {verificationCode}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div className="border-t border-slate-400 pt-2">
                    <p className="text-slate-500">Registrar / Authorized Signatory</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2">
                    <p className="text-slate-500">Official Seal</p>
                  </div>
                </div>
                <p className="mt-4 text-[8px] text-slate-500">
                  Document generated by Interscola Academic Assessment Network.
                  Numeric grades reflect student-entered year-end records subject
                  to institutional verification policies.
                </p>
              </footer>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactNode {
  return (
    <div>
      <p className="text-[9px] font-semibold text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-slate-900">{value}</p>
    </div>
  );
}
