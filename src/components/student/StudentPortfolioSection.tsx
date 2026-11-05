'use client';

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS_TR,
  categoryBadgeClass,
  PORTFOLIO_FILTERS,
  type PortfolioFilterId,
} from '@/lib/student-portfolio/category-labels';
import { computePortfolioKpis } from '@/lib/student-portfolio/portfolio-metrics';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_GRADE_LEVELS,
  IMPACT_DESCRIPTION_MAX_LENGTH,
  type ActivityCategory,
  type ActivityGradeLevel,
  type ActivityItem,
  type ActivityPassportData,
} from '@/lib/student-portfolio/types';

interface StudentPortfolioSectionProps {
  initialData: ActivityPassportData;
  onSave: (
    data: ActivityPassportData,
  ) => Promise<{ success: boolean; error?: string; data?: ActivityPassportData }>;
}

interface ActivityFormState {
  category: ActivityCategory;
  title: string;
  organization: string;
  role: string;
  grades: ActivityGradeLevel[];
  hoursPerWeek: string;
  weeksPerYear: string;
  impactDescription: string;
  certificateUrl: string;
}

const EMPTY_FORM: ActivityFormState = {
  category: 'leadership',
  title: '',
  organization: '',
  role: '',
  grades: [],
  hoursPerWeek: '3',
  weeksPerYear: '30',
  impactDescription: '',
  certificateUrl: '',
};

function newActivityId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function itemToForm(item: ActivityItem): ActivityFormState {
  return {
    category: item.category,
    title: item.title,
    organization: item.organization,
    role: item.role,
    grades: [...item.grades],
    hoursPerWeek: String(item.hoursPerWeek),
    weeksPerYear: String(item.weeksPerYear),
    impactDescription: item.impactDescription,
    certificateUrl: item.certificateUrl ?? '',
  };
}

function formToItem(
  form: ActivityFormState,
  existing?: ActivityItem,
): ActivityItem | { error: string } {
  const title = form.title.trim();
  const organization = form.organization.trim();
  const role = form.role.trim();
  const impactDescription = form.impactDescription.trim();
  const hoursPerWeek = Number.parseFloat(form.hoursPerWeek);
  const weeksPerYear = Number.parseInt(form.weeksPerYear, 10);

  if (!title || !organization || !role) {
    return { error: 'Başlık, kurum ve rol zorunludur.' };
  }
  if (form.grades.length === 0) {
    return { error: 'En az bir sınıf yılı seçin (9–12).' };
  }
  if (
    !impactDescription ||
    impactDescription.length > IMPACT_DESCRIPTION_MAX_LENGTH
  ) {
    return {
      error: `Etki açıklaması 1–${IMPACT_DESCRIPTION_MAX_LENGTH} karakter olmalı.`,
    };
  }
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0 || hoursPerWeek > 80) {
    return { error: 'Haftalık saat 1–80 arasında olmalı.' };
  }
  if (
    !Number.isFinite(weeksPerYear) ||
    weeksPerYear <= 0 ||
    weeksPerYear > 52
  ) {
    return { error: 'Yıllık hafta 1–52 arasında olmalı.' };
  }

  const certificateUrl = form.certificateUrl.trim();
  let normalizedCert: string | undefined;
  if (certificateUrl) {
    try {
      const url = new URL(certificateUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { error: 'Belge linki http veya https olmalı.' };
      }
      normalizedCert = url.toString();
    } catch {
      return { error: 'Geçerli bir belge URL’si girin.' };
    }
  }

  return {
    id: existing?.id ?? newActivityId(),
    category: form.category,
    title,
    organization,
    role,
    grades: [...form.grades].sort(),
    hoursPerWeek,
    weeksPerYear,
    impactDescription,
    certificateUrl: normalizedCert,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

export function StudentPortfolioSection({
  initialData,
  onSave,
}: StudentPortfolioSectionProps): ReactNode {
  const [passport, setPassport] = useState<ActivityPassportData>(initialData);
  const [filter, setFilter] = useState<PortfolioFilterId>('all');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const kpis = useMemo(
    () => computePortfolioKpis(passport.items),
    [passport.items],
  );

  const filteredItems = useMemo(() => {
    if (filter === 'all') return passport.items;
    return passport.items.filter((item) => item.category === filter);
  }, [filter, passport.items]);

  function persist(nextItems: ActivityItem[]) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await onSave({ items: nextItems });
      if (!result.success) {
        setError(result.error ?? 'Kayıt başarısız.');
        return;
      }
      if (result.data) setPassport(result.data);
      setSuccess('Aktivite pasaportu güncellendi.');
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: ActivityItem) {
    setEditingId(item.id);
    setForm(itemToForm(item));
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function toggleGrade(grade: ActivityGradeLevel) {
    setForm((current) => {
      const has = current.grades.includes(grade);
      return {
        ...current,
        grades: has
          ? current.grades.filter((g) => g !== grade)
          : [...current.grades, grade],
      };
    });
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const existing = editingId
      ? passport.items.find((item) => item.id === editingId)
      : undefined;
    const built = formToItem(form, existing);
    if ('error' in built) {
      setFormError(built.error);
      return;
    }

    const nextItems = editingId
      ? passport.items.map((item) => (item.id === editingId ? built : item))
      : [...passport.items, built];

    closeForm();
    persist(nextItems);
  }

  function handleDelete(itemId: string) {
    const nextItems = passport.items.filter((item) => item.id !== itemId);
    persist(nextItems);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-slate-950/90 to-fuchsia-500/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-200/90">
              Aktivite pasaportu (Common App / UCAS)
            </p>
            <p className="mt-1 max-w-2xl text-xs text-slate-400">
              Sosyal sorumluluk, spor, sanat ve liderlik faaliyetlerinizi
              uluslararası başvuru formatında kaydedin.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-50 transition enabled:hover:bg-violet-500/30 disabled:opacity-60"
          >
            <Plus className="size-4" />
            Yeni Aktivite Ekle
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Toplam faaliyet adedi"
            value={String(kpis.totalActivities)}
          />
          <KpiCard
            label="Kümülatif yıllık emek (saat)"
            value={String(kpis.cumulativeAnnualHours)}
          />
          <KpiCard
            label="Liderlik rolü sayısı"
            value={String(kpis.leadershipCount)}
          />
        </div>
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

      <div className="flex flex-wrap gap-2">
        {PORTFOLIO_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === option.id
                ? 'border-violet-400/45 bg-violet-500/20 text-violet-50'
                : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
          <p className="text-sm text-slate-400">
            {passport.items.length === 0
              ? 'Henüz aktivite eklenmedi. Common App Activities bölümüne benzer kayıtlar oluşturun.'
              : 'Seçili filtreyle eşleşen aktivite yok.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredItems.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${categoryBadgeClass(item.category)}`}
                    >
                      {CATEGORY_LABELS_TR[item.category]}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.grades.map((g) => `${g}. sınıf`).join(' · ')}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-50">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.role} · {item.organization}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.hoursPerWeek} saat/hafta × {item.weeksPerYear} hafta
                    ≈{' '}
                    <span className="font-medium text-slate-300">
                      {Math.round(item.hoursPerWeek * item.weeksPerYear)} saat/yıl
                    </span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {item.impactDescription}
                  </p>
                  {item.certificateUrl ? (
                    <a
                      href={item.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
                    >
                      <ExternalLink className="size-3" />
                      Belge / sertifika
                    </a>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openEdit(item)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                    aria-label="Sil"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-form-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="activity-form-title"
                className="text-lg font-semibold text-slate-50"
              >
                {editingId ? 'Aktiviteyi düzenle' : 'Yeni aktivite'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              {formError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                >
                  {formError}
                </p>
              ) : null}

              <label className="block text-sm">
                <span className="text-slate-300">Kategori</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((c) => ({
                      ...c,
                      category: event.target.value as ActivityCategory,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                >
                  {ACTIVITY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS_TR[cat]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">Faaliyet başlığı</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, title: event.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  placeholder="örn. Model UN, Okul Orkestrası"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-300">Kurum / platform</span>
                  <input
                    required
                    value={form.organization}
                    onChange={(event) =>
                      setForm((c) => ({
                        ...c,
                        organization: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Rolünüz</span>
                  <input
                    required
                    value={form.role}
                    onChange={(event) =>
                      setForm((c) => ({ ...c, role: event.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                    placeholder="örn. Kulüp başkanı"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm text-slate-300">
                  Sınıf yılları (9–12)
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACTIVITY_GRADE_LEVELS.map((grade) => {
                    const checked = form.grades.includes(grade);
                    return (
                      <label
                        key={grade}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                          checked
                            ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-50'
                            : 'border-white/10 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleGrade(grade)}
                        />
                        {grade}. sınıf
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-300">Saat / hafta</span>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    required
                    value={form.hoursPerWeek}
                    onChange={(event) =>
                      setForm((c) => ({
                        ...c,
                        hoursPerWeek: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-300">Hafta / yıl</span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    required
                    value={form.weeksPerYear}
                    onChange={(event) =>
                      setForm((c) => ({
                        ...c,
                        weeksPerYear: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="text-slate-300">
                  Somut etki / kazanım ({form.impactDescription.length}/
                  {IMPACT_DESCRIPTION_MAX_LENGTH})
                </span>
                <textarea
                  required
                  maxLength={IMPACT_DESCRIPTION_MAX_LENGTH}
                  rows={3}
                  value={form.impactDescription}
                  onChange={(event) =>
                    setForm((c) => ({
                      ...c,
                      impactDescription: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  placeholder="Ölçülebilir sonuç: kaç kişiye ulaştınız, ne başardınız?"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">
                  Belge linki (isteğe bağlı)
                </span>
                <input
                  type="url"
                  value={form.certificateUrl}
                  onChange={(event) =>
                    setForm((c) => ({
                      ...c,
                      certificateUrl: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100"
                  placeholder="https://…"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
