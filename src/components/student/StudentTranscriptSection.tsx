'use client';

import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  OfficialTranscriptPrintModal,
  type TranscriptStudentIdentity,
} from '@/components/student/OfficialTranscriptPrintModal';
import type { AcademicTranscriptData } from '@/lib/student-transcript/types';
import { transcriptHasPrintableGrades } from '@/lib/student-transcript/print-rows';
import {
  GRADE_LEVELS,
  type GradeLevel,
  type SubjectRecord,
} from '@/lib/student-transcript/types';
import { computeAcademicTranscriptMetrics } from '@/lib/student-transcript/gpa-calculator';

interface StudentTranscriptSectionProps {
  initialData: AcademicTranscriptData;
  studentIdentity: TranscriptStudentIdentity;
  onSave: (
    transcript: AcademicTranscriptData,
  ) => Promise<{ success: boolean; error?: string; data?: AcademicTranscriptData }>;
}

function newSubjectId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StudentTranscriptSection({
  initialData,
  studentIdentity,
  onSave,
}: StudentTranscriptSectionProps): ReactNode {
  const [draft, setDraft] = useState<AcademicTranscriptData>(initialData);
  const [activeGrade, setActiveGrade] = useState<GradeLevel>(10);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const preview = useMemo(
    () => computeAcademicTranscriptMetrics(draft.years),
    [draft.years],
  );

  const officialTranscript = useMemo(
    () => ({ ...draft, ...preview }),
    [draft, preview],
  );

  const hasPrintableGrades = transcriptHasPrintableGrades(officialTranscript);
  const canPrintOfficial =
    Boolean(draft.updatedAt) && hasPrintableGrades;
  const printDisabledReason = !hasPrintableGrades
    ? 'Resmî çıktı için en az bir sınıf notu girin.'
    : !draft.updatedAt
      ? 'Önce notlarınızı kaydedin.'
      : null;

  function updateYear(
    grade: GradeLevel,
    updater: (
      year: AcademicTranscriptData['years'][GradeLevel],
    ) => AcademicTranscriptData['years'][GradeLevel],
  ) {
    setDraft((current) => ({
      ...current,
      years: {
        ...current.years,
        [grade]: updater(current.years[grade]),
      },
    }));
  }

  function setOverallAverage(grade: GradeLevel, raw: string) {
    const trimmed = raw.trim();
    updateYear(grade, (year) => {
      if (trimmed === '') {
        const { overallAverage: _removed, ...rest } = year;
        return { ...rest, grade, subjects: year.subjects ?? [] };
      }
      const num = Number.parseFloat(trimmed);
      return {
        ...year,
        grade,
        overallAverage: Number.isFinite(num) ? num : year.overallAverage,
      };
    });
  }

  function addSubject(grade: GradeLevel) {
    const subject: SubjectRecord = {
      id: newSubjectId(),
      name: '',
      score100: 0,
      weeklyHours: 4,
    };
    updateYear(grade, (year) => ({
      ...year,
      subjects: [...(year.subjects ?? []), subject],
    }));
  }

  function updateSubject(
    grade: GradeLevel,
    subjectId: string,
    patch: Partial<SubjectRecord>,
  ) {
    updateYear(grade, (year) => ({
      ...year,
      subjects: (year.subjects ?? []).map((item) =>
        item.id === subjectId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeSubject(grade: GradeLevel, subjectId: string) {
    updateYear(grade, (year) => ({
      ...year,
      subjects: (year.subjects ?? []).filter((item) => item.id !== subjectId),
    }));
  }

  function handleSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const payload: AcademicTranscriptData = {
        ...draft,
        ...preview,
      };
      const result = await onSave(payload);
      if (!result.success) {
        setError(result.error ?? 'Kayıt başarısız.');
        return;
      }
      if (result.data) setDraft(result.data);
      setSuccess('Akademik transkriptin kaydedildi.');
    });
  }

  const year = draft.years[activeGrade];
  const subjects = year.subjects ?? [];

  return (
    <div className="space-y-6">
      <OfficialTranscriptPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        transcript={officialTranscript}
        identity={studentIdentity}
      />

      <div className="rounded-3xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-teal-500/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-200/90">
            Uluslararası transkript özeti
          </p>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              disabled={!canPrintOfficial}
              title={printDisabledReason ?? undefined}
              onClick={() => {
                if (canPrintOfficial) setPrintModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 transition enabled:hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FileText className="size-3.5" />
              <span aria-hidden>📄</span>
              Resmî Transkript Yazdır / PDF İndir
            </button>
            {printDisabledReason ? (
              <p className="max-w-[220px] text-right text-[10px] text-amber-200/90">
                {printDisabledReason}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Kümülatif lise ortalaması"
            value={
              preview.cumulative100 > 0
                ? `%${preview.cumulative100.toFixed(1)}`
                : '—'
            }
          />
          <KpiCard
            label="ABD / WES 4.0 karşılığı"
            value={
              preview.gpa4Scale > 0
                ? `${preview.gpa4Scale.toFixed(2)} / 4.00`
                : '—'
            }
          />
          <KpiCard
            label="Harf notu"
            value={preview.wesEquivalentGrade}
          />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          10, 11 ve 12. sınıf yıl sonu ortalamalarının aritmetik ortalaması;
          4.0 GPA her sınıf için WES baremine göre dönüştürülüp
          ortalanır.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
          {GRADE_LEVELS.map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => setActiveGrade(grade)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeGrade === grade
                  ? 'bg-indigo-500/25 text-white'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
              }`}
            >
              {grade}. Sınıf
            </button>
          ))}
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Yıl sonu genel ortalama (100&apos;lük)
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Resmi karne ortalamanız. Boş bırakırsanız aşağıdaki ders
              satırlarından haftalık saat ağırlıklı ortalama hesaplanır.
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={year.overallAverage ?? ''}
              onChange={(event) =>
                setOverallAverage(activeGrade, event.target.value)
              }
              className="mt-3 w-full max-w-xs rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
              placeholder="örn. 87.5"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-200">
                Ders detayı (isteğe bağlı)
              </h3>
              <button
                type="button"
                onClick={() => addSubject(activeGrade)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100 transition hover:bg-sky-500/20"
              >
                <Plus className="size-3.5" />
                Ders ekle
              </button>
            </div>

            {subjects.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Henüz ders satırı yok. Üniversite başvuruları için ders adı,
                yıl sonu notu ve haftalık ders saati ekleyebilirsiniz.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {subjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:grid-cols-[1fr_100px_100px_auto]"
                  >
                    <input
                      type="text"
                      value={subject.name}
                      onChange={(event) =>
                        updateSubject(activeGrade, subject.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Ders adı"
                      className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/40"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={subject.score100}
                      onChange={(event) =>
                        updateSubject(activeGrade, subject.id, {
                          score100: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      aria-label="Yıl sonu notu"
                      className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/40"
                      placeholder="Not"
                    />
                    <input
                      type="number"
                      min={1}
                      max={40}
                      step={1}
                      value={subject.weeklyHours}
                      onChange={(event) =>
                        updateSubject(activeGrade, subject.id, {
                          weeklyHours:
                            Number.parseInt(event.target.value, 10) || 1,
                        })
                      }
                      aria-label="Haftalık saat"
                      className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/40"
                      placeholder="Saat/hf"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubject(activeGrade, subject.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/20"
                      aria-label="Dersi kaldır"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {draft.updatedAt ? (
          <p className="text-xs text-slate-500">
            Son kayıt:{' '}
            {new Intl.DateTimeFormat('tr-TR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(draft.updatedAt))}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition enabled:hover:brightness-110 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Transkripti kaydet
        </button>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">
        {value}
      </p>
    </div>
  );
}
