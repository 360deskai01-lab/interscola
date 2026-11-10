'use client';

import type { CoordinatorSchoolReportData } from '@/app/coordinator/coordinator-report-types';
import type { ReactNode } from 'react';

export interface CoordinatorSchoolA4ReportProps {
  report: CoordinatorSchoolReportData;
  printRootId?: string;
}

function formatReportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pctLabel(value: number | null, suffix = '%'): string {
  if (value === null) return '—';
  return `${value}${suffix}`;
}

export function CoordinatorSchoolA4Report({
  report,
  printRootId = 'coordinator-school-a4-report',
}: CoordinatorSchoolA4ReportProps): ReactNode {
  const sat = report.academic.avgSatScore;
  const ielts = report.academic.avgIeltsBand;

  return (
    <article
      id={printRootId}
      className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <header className="border-b-2 border-indigo-900/20 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-8 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-indigo-800/40 bg-indigo-950 text-sm font-bold text-white"
              aria-hidden
            >
              ISL
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-indigo-800">
                Interscola Institutional Report
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {report.organizationName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {report.emblemLabel}
                {report.branchCount > 0
                  ? ` · ${report.branchCount} şube`
                  : ' · Merkez kurum'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Rapor tarihi: {formatReportDate(report.reportIssuedAtIso)}
              </p>
            </div>
          </div>
          <div className="rounded-lg border-2 border-indigo-900/25 bg-white px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-900">
              Doğrulama kodu
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-indigo-950">
              {report.verificationCode}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 border-b border-slate-200 px-8 py-6 sm:grid-cols-3">
        <KpiPanel
          title="Lisans & katılım"
          items={[
            {
              label: 'Öğrenci doluluğu',
              value:
                report.license.studentQuota != null
                  ? `${report.license.studentsUsed} / ${report.license.studentQuota}`
                  : `${report.license.studentsUsed} aktif`,
            },
            {
              label: 'Öğretmen doluluğu',
              value: `${report.license.teachersUsed} / ${report.license.teacherQuota}`,
            },
            {
              label: 'Katılım kodu',
              value: report.joinCode?.trim() || '—',
            },
          ]}
          accent="from-sky-500/15 to-indigo-500/10"
        />
        <KpiPanel
          title="Ortalama sınav skorları"
          items={[
            {
              label: 'Digital SAT',
              value: sat !== null ? `${sat} /1600` : '—',
            },
            {
              label: 'IELTS band',
              value: ielts !== null ? `${ielts.toFixed(1)} /9.0` : '—',
            },
            {
              label: 'CAIE başarı',
              value: pctLabel(report.academic.caieSuccessPercent),
            },
          ]}
          accent="from-emerald-500/15 to-teal-500/10"
        />
        <KpiPanel
          title="Tamamlama oranı"
          items={[
            {
              label: 'Resmi deneme hacmi',
              value: String(report.academic.totalCompletedAttempts),
            },
            {
              label: 'Öğrenci tamamlama',
              value: pctLabel(report.academic.completionRatePercent),
            },
            {
              label: 'Lisans tipi',
              value: report.licenseType?.replace(/_/g, ' ') || 'Standart',
            },
          ]}
          accent="from-violet-500/15 to-fuchsia-500/10"
        />
      </section>

      {report.caieAo.showBlock ? (
        <section className="border-b border-slate-200 px-8 py-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Cambridge Assessment Objectives (AO) Dağılımı
            </h2>
            <p className="text-base font-bold text-indigo-950">
              {report.caieAo.cambridgeGradeHeadline}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            CAIE / A-Level resmi denemeleri ({report.caieAo.attemptCount} kayıt
            · kurum ortalaması)
          </p>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3 font-semibold">Hedef</th>
                <th className="py-2 pr-3 text-right font-semibold">Ort. puan</th>
                <th className="py-2 text-right font-semibold">Ort. %</th>
              </tr>
            </thead>
            <tbody>
              {report.caieAo.rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 text-slate-800">
                    <span className="font-semibold">
                      AO
                      {row.key === 'ao1_knowledge'
                        ? '1'
                        : row.key === 'ao2_application'
                          ? '2'
                          : '3'}
                    </span>
                    <span className="text-slate-600"> — {row.label}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-slate-900">
                    {row.pointsDisplay}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">
                    {row.percentDisplay}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="px-8 py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Zümre & öğretmen performansı
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-3 font-semibold">Öğretmen</th>
              <th className="py-2 pr-3 font-semibold">Şube</th>
              <th className="py-2 pr-3 text-right font-semibold">Öğrenci</th>
              <th className="py-2 pr-3 text-right font-semibold">Ort. SAT</th>
              <th className="py-2 text-right font-semibold">Ort. IELTS</th>
            </tr>
          </thead>
          <tbody>
            {report.faculty.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  Kayıtlı öğretmen bulunamadı.
                </td>
              </tr>
            ) : (
              report.faculty.map((row) => (
                <tr
                  key={`${row.displayName}-${row.email ?? ''}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {row.displayName}
                    {row.email ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {row.email}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {row.branchName ?? '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {row.linkedStudentCount}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {row.avgSatScore !== null ? row.avgSatScore : '—'}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.avgIeltsBand !== null
                      ? row.avgIeltsBand.toFixed(1)
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="border-t border-slate-200 px-8 py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kritik kurumsal eksikler (Weakness Ledger özeti)
        </h2>
        {report.criticalWeaknesses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Henüz yeterli deneme geri bildirimi yok; öğrenciler tamamladıkça
            kazanım eksikleri burada görünecek.
          </p>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-800">
            {report.criticalWeaknesses.map((item) => (
              <li key={item.topic}>
                <span className="font-medium">{item.topic}</span>
                <span className="text-slate-500">
                  {' '}
                  — {item.occurrenceCount} kayıt
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-4 border-t border-slate-200 px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Kurumsal imza / kaşe alanı
            </p>
            <p className="mt-8 border-b border-slate-400 pb-1 text-sm font-medium text-slate-800">
              {report.coordinatorName}
            </p>
            <p className="mt-1 text-xs text-slate-500">Kurum koordinatörü</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Tarih: {formatReportDate(report.reportIssuedAtIso)}
            <br />
            Rapor doğrulama: {report.verificationCode}
          </div>
        </div>
        <p className="mt-6 text-[10px] leading-relaxed text-slate-500">
          Bu belge Interscola koordinatör masasından üretilmiştir. Yazdır
          diyaloğunda &quot;PDF olarak kaydet&quot; ile arşivleyebilirsiniz.
        </p>
      </footer>
    </article>
  );
}

function KpiPanel({
  title,
  items,
  accent,
}: {
  title: string;
  items: { label: string; value: string }[];
  accent: string;
}): ReactNode {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br ${accent} p-4`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex justify-between gap-2">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
