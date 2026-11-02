'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  X,
} from 'lucide-react';
import { getGlobalExamAuditLogsAction } from '@/app/admin/audit-actions';
import type {
  GlobalExamAuditLogRow,
  GlobalExamAuditMetrics,
  GlobalExamAuditResult,
  ExamAuditSourceKind,
} from '@/lib/admin/exam-audit-types';

interface GlobalExamAuditSectionProps {
  initialData: GlobalExamAuditResult | null;
  loadError?: string;
}

const CURRICULUM_FILTERS = ['ALL', 'SAT', 'IELTS', 'CAIE'] as const;

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function curriculumBadgeClass(curriculum: string): string {
  switch (curriculum.toUpperCase()) {
    case 'SAT':
      return 'border-violet-400/40 bg-violet-500/15 text-violet-100';
    case 'IELTS':
      return 'border-sky-400/40 bg-sky-500/15 text-sky-100';
    case 'CAIE':
      return 'border-rose-400/40 bg-rose-500/15 text-rose-100';
    default:
      return 'border-white/15 bg-white/[0.05] text-slate-300';
  }
}

function sourceBadgeLabel(kind: ExamAuditSourceKind): string {
  switch (kind) {
    case 'teacher_exam':
      return 'Öğretmen Ataması';
    case 'teacher_study':
      return 'Öğretmen Çalışması';
    case 'free_diagnostic':
      return 'Serbest Teşhis';
    case 'anonymous_pool':
      return 'Anonim / Açık Havuz';
    default:
      return 'Bilinmeyen Kaynak';
  }
}

function sourceBadgeClass(kind: ExamAuditSourceKind): string {
  switch (kind) {
    case 'teacher_exam':
      return 'border-indigo-400/35 bg-indigo-500/12 text-indigo-100';
    case 'teacher_study':
      return 'border-amber-400/35 bg-amber-500/12 text-amber-100';
    case 'free_diagnostic':
      return 'border-cyan-400/35 bg-cyan-500/12 text-cyan-100';
    case 'anonymous_pool':
      return 'border-slate-500/35 bg-slate-500/12 text-slate-300';
    default:
      return 'border-white/10 bg-white/[0.04] text-slate-400';
  }
}

function formatScoreDisplay(row: GlobalExamAuditLogRow): string {
  const curriculum = row.curriculum.toUpperCase();
  if (row.scaledResult) {
    if (curriculum === 'IELTS' && !row.scaledResult.toLowerCase().includes('band')) {
      return `Band ${row.scaledResult}`;
    }
    return row.scaledResult;
  }
  if (row.rawScore !== null && row.maxScore !== null) {
    return `${Math.round(row.rawScore)} / ${Math.round(row.maxScore)}`;
  }
  if (row.percentage !== null) {
    return `%${row.percentage}`;
  }
  return '—';
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ReportCardModal({
  row,
  onClose,
}: {
  row: GlobalExamAuditLogRow;
  onClose: () => void;
}): ReactNode {
  const breakdown =
    row.evaluations?.metricBreakdown ?? row.metricBreakdown ?? null;
  const topics = row.evaluations?.remedialTopics ?? [];
  const feedback = row.evaluations?.feedback?.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-report-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0 pr-4">
            <h3
              id="audit-report-title"
              className="text-lg font-semibold text-slate-50"
            >
              Sınav Karnesi
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-400">
              {row.examTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Sonuç: </span>
            {formatScoreDisplay(row)}
          </p>
          {feedback ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Değerlendirme özeti
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {feedback}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Bu deneme için kayıtlı geri bildirim metni yok.
            </p>
          )}
          {breakdown && Object.keys(breakdown).length > 0 ? (
            <dl className="mt-4 space-y-2 rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-3 text-sm">
              <dt className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                Metrik dağılımı
              </dt>
              {Object.entries(breakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dd className="text-slate-400">{key}</dd>
                  <dd className="font-medium tabular-nums text-slate-100">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {topics.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Önerilen tekrar konuları
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
                {topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GlobalExamAuditSection({
  initialData,
  loadError,
}: GlobalExamAuditSectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<GlobalExamAuditResult | null>(initialData);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [curriculum, setCurriculum] =
    useState<(typeof CURRICULUM_FILTERS)[number]>('ALL');
  const [page, setPage] = useState(initialData?.page ?? 1);
  const [reportRow, setReportRow] = useState<GlobalExamAuditLogRow | null>(null);

  const metrics: GlobalExamAuditMetrics = data?.metrics ?? {
    totalAttempts: 0,
    todayAttempts: 0,
    averageSatScore: null,
    averageIeltsBand: null,
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.limit))
    : 1;

  const fetchPage = useCallback(
    (nextPage: number, nextCurriculum: (typeof CURRICULUM_FILTERS)[number]) => {
      startTransition(async () => {
        setError(null);
        const result = await getGlobalExamAuditLogsAction({
          page: nextPage,
          limit: data?.limit ?? 25,
          curriculum: nextCurriculum === 'ALL' ? undefined : nextCurriculum,
        });
        if (!result.success || !result.data) {
          setError(result.error ?? 'Günlük yüklenemedi.');
          return;
        }
        setData(result.data);
        setPage(result.data.page);
        router.refresh();
      });
    },
    [data?.limit, router],
  );

  function handleCurriculumChange(value: (typeof CURRICULUM_FILTERS)[number]) {
    setCurriculum(value);
    fetchPage(1, value);
  }

  function handlePrevPage() {
    if (page <= 1 || pending) return;
    fetchPage(page - 1, curriculum);
  }

  function handleNextPage() {
    if (page >= totalPages || pending) return;
    fetchPage(page + 1, curriculum);
  }

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Toplam Deneme"
          value={String(metrics.totalAttempts)}
        />
        <MetricCard
          label="Bugün Çözülen"
          value={String(metrics.todayAttempts)}
        />
        <MetricCard
          label="Ortalama SAT"
          value={
            metrics.averageSatScore !== null
              ? String(metrics.averageSatScore)
              : '—'
          }
          hint="Son 5000 SAT kaydı"
        />
        <MetricCard
          label="Ortalama IELTS"
          value={
            metrics.averageIeltsBand !== null
              ? metrics.averageIeltsBand.toFixed(1)
              : '—'
          }
          hint="Son 5000 IELTS kaydı"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CURRICULUM_FILTERS.map((item) => {
            const active = curriculum === item;
            return (
              <button
                key={item}
                type="button"
                disabled={pending}
                onClick={() => handleCurriculumChange(item)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                  active
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {item === 'ALL' ? 'Tümü' : item}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          {pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Yükleniyor…
            </span>
          ) : (
            <>
              Sayfa {page} / {totalPages} · Toplam {data?.total ?? 0} kayıt
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Öğrenci</th>
              <th className="px-4 py-3 font-medium">Sınav</th>
              <th className="px-4 py-3 font-medium">Kaynak</th>
              <th className="px-4 py-3 font-medium">Skor / Band</th>
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium">Eylem</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <ClipboardList className="mx-auto size-8 opacity-40" />
                  <p className="mt-2">Denetim kaydı bulunamadı.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-slate-300">
                    <p className="font-medium text-slate-100">
                      {row.studentId
                        ? row.studentFullName?.trim() || 'Kayıtlı öğrenci'
                        : 'Anonim / Açık Havuz'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.studentEmail?.trim() ||
                        (row.studentId ? 'E-posta yok' : 'Misafir oturumu')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{row.examTitle}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${curriculumBadgeClass(row.curriculum)}`}
                    >
                      {row.curriculum}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sourceBadgeClass(row.sourceKind)}`}
                    >
                      {sourceBadgeLabel(row.sourceKind)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">
                    {formatScoreDisplay(row)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setReportRow(row)}
                      className="rounded-lg border border-violet-400/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/20"
                    >
                      Karnesini Gör
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={pending || page <= 1}
          onClick={handlePrevPage}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Önceki
        </button>
        <button
          type="button"
          disabled={pending || page >= totalPages}
          onClick={handleNextPage}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          Sonraki
          <ChevronRight className="size-4" />
        </button>
      </div>

      {reportRow ? (
        <ReportCardModal row={reportRow} onClose={() => setReportRow(null)} />
      ) : null}
    </div>
  );
}
