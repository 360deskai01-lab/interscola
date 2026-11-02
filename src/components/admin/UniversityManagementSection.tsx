'use client';

import { useRouter } from 'next/navigation';
import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Building2,
  ImageIcon,
  Loader2,
  Pencil,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { updateUniversityMediaAction } from '@/app/admin/university-actions';
import type {
  AdminUniversitiesSummary,
  AdminUniversityRow,
  BulkUniversityImportRow,
  UniversityPublicationStatus,
  UniversityUpsertInput,
} from '@/lib/universities/admin-types';
import { parseJsonUniversityImports } from '@/lib/universities/import-parse';

const SAMPLE_CSV = `name,country,city,minSat,minIelts,minAlevel,websiteUrl
Bocconi University,İtalya,Milano,1450,7.0,AAB,https://www.unibocconi.eu
Technical University of Munich,Almanya,Münih,1400,6.5,,https://www.tum.de`;

interface UniversityManagementSectionProps {
  data: AdminUniversitiesSummary | null;
  loadError?: string;
  onToggleFeatured: (
    id: string,
    isFeatured: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  onBulkImport: (
    rows: BulkUniversityImportRow[],
  ) => Promise<{ success: boolean; error?: string; imported?: number }>;
  onUpdateStatus: (
    id: string,
    status: UniversityPublicationStatus,
  ) => Promise<{ success: boolean; error?: string }>;
  onUpsertUniversity: (
    input: UniversityUpsertInput,
  ) => Promise<{ success: boolean; error?: string }>;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvToRows(text: string): BulkUniversityImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]!).map((cell) => cell.toLowerCase());
  const dataLines = lines.slice(1);

  const indexOf = (keys: string[]): number =>
    header.findIndex((cell) => keys.includes(cell));

  const nameIdx = indexOf(['name', 'üniversite', 'universite']);
  const countryIdx = indexOf(['country', 'ülke', 'ulke']);
  const cityIdx = indexOf(['city', 'şehir', 'sehir']);
  const satIdx = indexOf(['minsat', 'min_sat', 'sat']);
  const ieltsIdx = indexOf(['minielts', 'min_ielts', 'ielts']);
  const alevelIdx = indexOf(['minalevel', 'min_alevel', 'alevel']);
  const webIdx = indexOf(['websiteurl', 'website', 'url']);
  const slugIdx = indexOf(['slug']);
  const statusIdx = indexOf(['status', 'durum']);

  return dataLines.map((line) => {
    const cells = parseCsvLine(line);
    const pick = (idx: number): string =>
      idx >= 0 ? (cells[idx]?.trim() ?? '') : '';

    const minSatRaw = pick(satIdx);
    const minIeltsRaw = pick(ieltsIdx);

    const statusRaw = pick(statusIdx).toLowerCase();
    let status: UniversityPublicationStatus | undefined;
    if (statusRaw === 'draft' || statusRaw === 'taslak') status = 'draft';
    else if (statusRaw === 'archived' || statusRaw === 'arşiv' || statusRaw === 'arsiv') {
      status = 'archived';
    } else if (statusRaw === 'published' || statusRaw === 'yayında' || statusRaw === 'yayinda') {
      status = 'published';
    }

    return {
      name: pick(nameIdx >= 0 ? nameIdx : 0),
      country: pick(countryIdx >= 0 ? countryIdx : 1),
      city: pick(cityIdx >= 0 ? cityIdx : 2),
      slug: pick(slugIdx) || undefined,
      minSat: minSatRaw ? Number.parseInt(minSatRaw, 10) : undefined,
      minIelts: minIeltsRaw ? Number.parseFloat(minIeltsRaw) : undefined,
      minAlevel: pick(alevelIdx) || undefined,
      websiteUrl: pick(webIdx) || undefined,
      status,
    };
  });
}

function MediaUrlPreview({
  label,
  url,
  variant,
}: {
  label: string;
  url: string;
  variant: 'logo' | 'cover';
}): ReactNode {
  const trimmed = url.trim();
  const [failed, setFailed] = useState(false);

  if (!trimmed || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/60 text-xs text-slate-500 ${
          variant === 'logo' ? 'size-24' : 'h-28 w-full'
        }`}
      >
        {trimmed && failed ? 'Önizleme yüklenemedi' : 'Önizleme'}
      </div>
    );
  }

  if (variant === 'logo') {
    return (
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-inner ring-1 ring-white/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trimmed}
          alt={label}
          className="size-full object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={trimmed}
        alt={label}
        className="size-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function statusBadge(status: AdminUniversityRow['status']): ReactNode {
  if (status === 'published') {
    return (
      <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-100">
        Yayında
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="rounded-full border border-slate-500/35 bg-slate-600/20 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
        Arşiv
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-100">
      Taslak
    </span>
  );
}

const SAMPLE_JSON = `[
  {
    "name": "Bocconi University",
    "slug": "bocconi-university",
    "country": "İtalya",
    "city": "Milano",
    "min_sat_score": 1450,
    "min_ielts_band": 7.0,
    "status": "draft"
  }
]`;

export function UniversityManagementSection({
  data,
  loadError,
  onToggleFeatured,
  onBulkImport,
  onUpdateStatus,
  onUpsertUniversity,
}: UniversityManagementSectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mediaPending, startMediaTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'csv' | 'json'>('csv');
  const [jsonImportText, setJsonImportText] = useState('');
  const [editUniversity, setEditUniversity] = useState<AdminUniversityRow | null>(
    null,
  );
  const [editForm, setEditForm] = useState<UniversityUpsertInput | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [mediaUniversity, setMediaUniversity] = useState<AdminUniversityRow | null>(
    null,
  );
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [sourceUrlInput, setSourceUrlInput] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [featuredOverrides, setFeaturedOverrides] = useState<
    Record<string, boolean>
  >({});

  const universities = data?.universities ?? [];
  const total = data?.total ?? 0;
  const featuredCount = useMemo(() => {
    if (universities.length === 0) return data?.featuredCount ?? 0;
    return universities.filter(
      (u) => featuredOverrides[u.id] ?? u.isFeatured,
    ).length;
  }, [data?.featuredCount, featuredOverrides, universities]);

  function isFeatured(u: AdminUniversityRow): boolean {
    return featuredOverrides[u.id] ?? u.isFeatured;
  }

  function openMediaModal(u: AdminUniversityRow) {
    setMediaUniversity(u);
    setLogoUrlInput(u.logoUrl ?? '');
    setCoverUrlInput(u.coverImageUrl ?? '');
    setSourceUrlInput(u.sourceUrl ?? '');
    setMediaError(null);
    setImportError(null);
  }

  function closeMediaModal() {
    setMediaUniversity(null);
    setMediaError(null);
  }

  function handleSaveMedia() {
    if (!mediaUniversity) return;

    startMediaTransition(async () => {
      const result = await updateUniversityMediaAction(
        mediaUniversity.id,
        logoUrlInput,
        coverUrlInput,
        sourceUrlInput,
      );
      if (!result.success) {
        setMediaError(result.message ?? 'Görseller kaydedilemedi.');
        return;
      }
      closeMediaModal();
      setImportSuccess(result.message ?? 'Görseller güncellendi.');
      router.refresh();
    });
  }

  function handleToggleFeatured(u: AdminUniversityRow) {
    const next = !isFeatured(u);
    setFeaturedOverrides((current) => ({ ...current, [u.id]: next }));

    startTransition(async () => {
      const result = await onToggleFeatured(u.id, next);
      if (!result.success) {
        setFeaturedOverrides((current) => {
          const copy = { ...current };
          delete copy[u.id];
          return copy;
        });
        setImportError(result.error ?? 'Vitrin güncellenemedi.');
        return;
      }
      router.refresh();
    });
  }

  function runBulkImport(rows: BulkUniversityImportRow[]) {
    startTransition(async () => {
      const result = await onBulkImport(rows);
      if (!result.success) {
        setImportError(result.error ?? 'İçe aktarma başarısız.');
        return;
      }
      setImportSuccess(`${result.imported ?? rows.length} üniversite içe aktarıldı.`);
      setImportOpen(false);
      router.refresh();
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);

    const text = await file.text();
    const isJson =
      file.name.toLowerCase().endsWith('.json') ||
      text.trimStart().startsWith('[') ||
      text.trimStart().startsWith('{');

    if (isJson) {
      const parsed = parseJsonUniversityImports(text);
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }
      runBulkImport(parsed.rows);
      return;
    }

    const rows = parseCsvToRows(text);
    if (rows.length === 0) {
      setImportError('CSV dosyasında veri satırı bulunamadı.');
      return;
    }
    runBulkImport(rows);
  }

  function handleJsonImportSubmit() {
    setImportError(null);
    setImportSuccess(null);
    const parsed = parseJsonUniversityImports(jsonImportText);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }
    runBulkImport(parsed.rows);
  }

  function openEditModal(u: AdminUniversityRow | null) {
    if (!u) {
      setEditUniversity(null);
      setEditForm({
        name: '',
        country: '',
        city: '',
        status: 'draft',
      });
    } else {
      setEditUniversity(u);
      setEditForm({
        id: u.id,
        name: u.name,
        country: u.country,
        city: u.city ?? '',
        slug: u.slug,
        minSatScore: u.minSatScore,
        minIeltsBand: u.minIeltsBand,
        minAlevel: u.minAlevel,
        websiteUrl: u.websiteUrl,
        tuitionFeeRange: u.tuitionFeeRange,
        status: u.status,
      });
    }
    setEditError(null);
  }

  function closeEditModal() {
    setEditUniversity(null);
    setEditForm(null);
    setEditError(null);
  }

  function handleSaveEdit() {
    if (!editForm) return;
    startTransition(async () => {
      const result = await onUpsertUniversity(editForm);
      if (!result.success) {
        setEditError(result.error ?? 'Kayıt kaydedilemedi.');
        return;
      }
      closeEditModal();
      setImportSuccess('Üniversite kaydı güncellendi.');
      router.refresh();
    });
  }

  function handleStatusChange(u: AdminUniversityRow, status: UniversityPublicationStatus) {
    if (u.status === status) return;
    startTransition(async () => {
      const result = await onUpdateStatus(u.id, status);
      if (!result.success) {
        setImportError(result.error ?? 'Durum güncellenemedi.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {importError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{importError}</span>
        </div>
      ) : null}

      {importSuccess ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
        >
          {importSuccess}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Toplam üniversite
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">
              {total}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Vitrinde
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-indigo-200">
              <Sparkles className="size-5" />
              {featuredCount}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openEditModal(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
          >
            <Pencil className="size-4" />
            Yeni Üniversite
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen(true);
              setImportError(null);
              setImportSuccess(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
          >
            <Upload className="size-4" />
            Toplu İçe Aktarım
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Üniversite</th>
              <th className="px-4 py-3 font-medium">Ülke / Şehir</th>
              <th className="px-4 py-3 font-medium">Min SAT</th>
              <th className="px-4 py-3 font-medium">Min IELTS</th>
              <th className="px-4 py-3 font-medium">Min A-Level</th>
              <th className="px-4 py-3 font-medium">Vitrin</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Eylemler</th>
            </tr>
          </thead>
          <tbody>
            {universities.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <Building2 className="mx-auto size-8 opacity-40" />
                  <p className="mt-2">Kayıtlı üniversite yok.</p>
                </td>
              </tr>
            ) : (
              universities.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {u.city ? `${u.city}, ${u.country}` : u.country}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">
                    {u.minSatScore ?? '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">
                    {u.minIeltsBand !== null ? u.minIeltsBand.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {u.minAlevel ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleToggleFeatured(u)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                        isFeatured(u)
                          ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pending ? (
                        <Loader2 className="inline size-3 animate-spin" />
                      ) : null}{' '}
                      Anasayfada Göster
                    </button>
                  </td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`${u.name} yayın durumu`}
                        disabled={pending}
                        value={u.status}
                        onChange={(e) =>
                          handleStatusChange(
                            u,
                            e.target.value as UniversityPublicationStatus,
                          )
                        }
                        className="rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-[11px] text-slate-200 disabled:opacity-50"
                      >
                        <option value="draft">Taslak</option>
                        <option value="published">Yayında</option>
                        <option value="archived">Arşiv</option>
                      </select>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEditModal(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        <Pencil className="size-3" aria-hidden />
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => openMediaModal(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-400/35 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/20"
                        title="Görselleri Düzenle"
                      >
                        <ImageIcon className="size-3.5" aria-hidden />
                        Medya
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mediaUniversity ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="university-media-dialog-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeMediaModal}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/10"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
            <h3
              id="university-media-dialog-title"
              className="pr-10 text-lg font-semibold text-slate-50"
            >
              {mediaUniversity.name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Logo, kapak görseli ve istihbarat kaynağı
            </p>

            {mediaError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
              >
                {mediaError}
              </div>
            ) : null}

            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="admin-univ-logo-url"
                  className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Logo URL
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <input
                    id="admin-univ-logo-url"
                    type="url"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    placeholder="https://…/logo.png"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                  />
                  <MediaUrlPreview
                    key={`logo-${logoUrlInput}`}
                    label={`${mediaUniversity.name} logo`}
                    url={logoUrlInput}
                    variant="logo"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-univ-cover-url"
                  className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Kapak görseli URL
                </label>
                <div className="mt-2 space-y-3">
                  <input
                    id="admin-univ-cover-url"
                    type="url"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    placeholder="https://…/campus.jpg"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                  />
                  <MediaUrlPreview
                    key={`cover-${coverUrlInput}`}
                    label={`${mediaUniversity.name} kapak`}
                    url={coverUrlInput}
                    variant="cover"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-univ-source-url"
                  className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Resmi Kabul &amp; Başvuru Sayfası URL (source_url)
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Otonom istihbarat motorunun şart değişikliklerini izleyeceği
                  resmi web sayfası adresi.
                </p>
                <input
                  id="admin-univ-source-url"
                  type="url"
                  value={sourceUrlInput}
                  onChange={(e) => setSourceUrlInput(e.target.value)}
                  placeholder="https://www.unibocconi.it/en/admissions/..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400/50 focus:outline-none"
                />
              </div>

              <p className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2.5 text-xs leading-relaxed text-indigo-100/90">
                Şeffaf PNG veya SVG logo URL&apos;si ve kampüs fotoğrafı
                ekleyin. Boş bırakırsanız ilgili alan vitrinde varsayılan
                şablon kullanılır.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeMediaModal}
                disabled={mediaPending}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={mediaPending}
                onClick={handleSaveMedia}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {mediaPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/10"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
            <h3 className="text-lg font-semibold text-slate-50">
              Toplu İçe Aktarım (CSV / JSON)
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Slug verilirse upsert anahtarı slug olur; yoksa adından üretilir.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setImportMode('csv')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  importMode === 'csv'
                    ? 'bg-cyan-500/25 text-cyan-100'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setImportMode('json')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  importMode === 'json'
                    ? 'bg-cyan-500/25 text-cyan-100'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                JSON
              </button>
            </div>
            {importMode === 'csv' ? (
              <>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-300">
                  {SAMPLE_CSV}
                </pre>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-400/35 bg-cyan-500/10 px-4 py-8 text-sm text-cyan-100 transition hover:bg-cyan-500/15">
                  <Upload className="mb-2 size-6" />
                  CSV veya JSON dosyası seç
                  <input
                    type="file"
                    accept=".csv,text/csv,.json,application/json"
                    className="sr-only"
                    onChange={(e) => void handleFileChange(e)}
                  />
                </label>
              </>
            ) : (
              <>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-300">
                  {SAMPLE_JSON}
                </pre>
                <textarea
                  value={jsonImportText}
                  onChange={(e) => setJsonImportText(e.target.value)}
                  rows={8}
                  placeholder="JSON dizisi yapıştırın…"
                  className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleJsonImportSubmit}
                  className="mt-4 w-full rounded-xl border border-cyan-400/40 bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  ) : (
                    'JSON İçe Aktar'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="university-edit-dialog-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeEditModal}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/10"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
            <h3
              id="university-edit-dialog-title"
              className="text-lg font-semibold text-slate-50"
            >
              {editUniversity ? 'Üniversite Düzenle' : 'Yeni Üniversite'}
            </h3>
            {editError ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => f && { ...f, name: e.target.value })
                }
                placeholder="Üniversite adı"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <input
                type="text"
                value={editForm.slug ?? ''}
                onChange={(e) =>
                  setEditForm((f) => f && { ...f, slug: e.target.value })
                }
                placeholder="Slug (opsiyonel)"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editForm.country}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, country: e.target.value })
                  }
                  placeholder="Ülke"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, city: e.target.value })
                  }
                  placeholder="Şehir"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={editForm.minSatScore ?? ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            minSatScore: e.target.value
                              ? Number.parseInt(e.target.value, 10)
                              : null,
                          }
                        : f,
                    )
                  }
                  placeholder="Min SAT"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="number"
                  step="0.5"
                  value={editForm.minIeltsBand ?? ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            minIeltsBand: e.target.value
                              ? Number.parseFloat(e.target.value)
                              : null,
                          }
                        : f,
                    )
                  }
                  placeholder="Min IELTS"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={editForm.minAlevel ?? ''}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, minAlevel: e.target.value || null } : f,
                    )
                  }
                  placeholder="A-Level"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <input
                type="url"
                value={editForm.websiteUrl ?? ''}
                onChange={(e) =>
                  setEditForm((f) =>
                    f ? { ...f, websiteUrl: e.target.value || null } : f,
                  )
                }
                placeholder="Web sitesi URL"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              />
              <select
                value={editForm.status ?? 'draft'}
                onChange={(e) =>
                  setEditForm((f) =>
                    f
                      ? {
                          ...f,
                          status: e.target.value as UniversityPublicationStatus,
                        }
                      : f,
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              >
                <option value="draft">Taslak</option>
                <option value="published">Yayında</option>
                <option value="archived">Arşiv</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={pending}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleSaveEdit}
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
