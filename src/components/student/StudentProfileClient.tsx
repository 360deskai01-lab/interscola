'use client';

import Link from 'next/link';
import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  Copy,
  Loader2,
  UserCircle2,
} from 'lucide-react';
import type { StudentAcademicProfileRow } from '@/app/student/profile-actions';
import { updateStudentAcademicProfileAction } from '@/app/student/profile-actions';
import { absoluteUrl } from '@/lib/seo/site-url';
import { StudentHubNav } from '@/components/student/StudentHubNav';

interface StudentProfileClientProps {
  initial: StudentAcademicProfileRow;
}

function computeProfileFillPercent(data: StudentAcademicProfileRow): number {
  const parts = [
    data.firstName,
    data.lastName,
    data.highSchoolName,
    data.graduationYear !== null,
    data.linkedinUrl,
    data.externalPortfolioUrl,
    data.instagramHandle,
  ];
  const filled = parts.filter(Boolean).length;
  return Math.round((filled / parts.length) * 100);
}

export function StudentProfileClient({
  initial,
}: StudentProfileClientProps): ReactNode {
  const [form, setForm] = useState({
    firstName: initial.firstName ?? '',
    lastName: initial.lastName ?? '',
    highSchoolName: initial.highSchoolName ?? '',
    graduationYear:
      initial.graduationYear !== null ? String(initial.graduationYear) : '',
    linkedinUrl: initial.linkedinUrl ?? '',
    externalPortfolioUrl: initial.externalPortfolioUrl ?? '',
    instagramHandle: initial.instagramHandle ?? '',
    alumniNetworkOptIn: initial.alumniNetworkOptIn,
  });
  const [slug, setSlug] = useState(initial.publicPortfolioSlug);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const mergedPreview: StudentAcademicProfileRow = useMemo(
    () => ({
      ...initial,
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim() || null,
      highSchoolName: form.highSchoolName.trim() || null,
      graduationYear: form.graduationYear.trim()
        ? Number.parseInt(form.graduationYear, 10)
        : null,
      linkedinUrl: form.linkedinUrl.trim() || null,
      externalPortfolioUrl: form.externalPortfolioUrl.trim() || null,
      instagramHandle: form.instagramHandle.trim() || null,
      alumniNetworkOptIn: form.alumniNetworkOptIn,
      publicPortfolioSlug: slug,
    }),
    [form, initial, slug],
  );

  const fillPercent = computeProfileFillPercent(mergedPreview);

  const publicPortfolioUrl = slug
    ? absoluteUrl(`/portfolio/public/${slug}`)
    : '';

  async function copyPublicUrl() {
    if (!publicPortfolioUrl) return;
    try {
      await navigator.clipboard.writeText(publicPortfolioUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Panoya kopyalanamadı.');
    }
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateStudentAcademicProfileAction({
        firstName: form.firstName,
        lastName: form.lastName,
        highSchoolName: form.highSchoolName,
        graduationYear: form.graduationYear,
        linkedinUrl: form.linkedinUrl,
        externalPortfolioUrl: form.externalPortfolioUrl,
        instagramHandle: form.instagramHandle,
        alumniNetworkOptIn: form.alumniNetworkOptIn,
      });
      if (!result.success) {
        setError(result.error ?? 'Kayıt başarısız.');
        return;
      }
      setSuccess('Profil kaydedildi.');
      if (result.publicPortfolioSlug) {
        setSlug(result.publicPortfolioSlug);
      }
    });
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_40%_-15%,rgba(59,130,246,0.12),transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            ← Panele dön
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              🎓
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Akademik profil & pasaport
              </h1>
              <p className="text-xs text-slate-500">
                Üniversite başvurularına hazır kimlik özeti.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <StudentHubNav currentHref="/student/profile" />

          <div className="min-w-0 flex-1 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <UserCircle2 className="size-5 text-indigo-300" />
                  Profil doluluğu
                </div>
                <span className="text-sm font-semibold tabular-nums text-indigo-200">
                  %{fillPercent}
                </span>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-valuenow={fillPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width]"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
              >
                {error}
              </div>
            ) : null}
            {success ? (
              <div
                role="status"
                className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
              >
                <CheckCircle2 className="size-4 shrink-0" />
                {success}
              </div>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <h2 className="text-sm font-medium text-slate-200">
                Temel bilgiler
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-500">
                  Ad
                  <input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Soyad
                  <input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                  />
                </label>
                <label className="block text-xs text-slate-500 sm:col-span-2">
                  Lise adı
                  <input
                    value={form.highSchoolName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, highSchoolName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Mezuniyet yılı
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.graduationYear}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        graduationYear: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-indigo-400/40"
                    placeholder="2026"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <h2 className="text-sm font-medium text-slate-200">
                İsteğe bağlı bağlantılar
              </h2>
              <div className="mt-4 grid gap-4">
                <label className="block text-xs text-slate-500">
                  LinkedIn profili
                  <input
                    value={form.linkedinUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                    placeholder="linkedin.com/in/..."
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Harici portfolyo / site
                  <input
                    value={form.externalPortfolioUrl}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        externalPortfolioUrl: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                    placeholder="https://"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Instagram
                  <input
                    value={form.instagramHandle}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        instagramHandle: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                    placeholder="@kullanici veya tam URL"
                  />
                </label>
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-900/30 p-4">
                <input
                  type="checkbox"
                  checked={form.alumniNetworkOptIn}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      alumniNetworkOptIn: e.target.checked,
                    }))
                  }
                  className="mt-1 size-4 rounded border-white/20 bg-slate-900"
                />
                <span className="text-sm text-slate-300">
                  Üniversiteye yerleştiğimde Interscola Mezunlar Ağı&apos;na
                  katılmak istiyorum.
                </span>
              </label>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <h2 className="text-sm font-medium text-slate-200">
                Herkese açık dijital portfolyo bağlantısı
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Kaydettiğinde benzersiz bir kısa yol oluşturulur; aktivite
                pasaportunu bu adreste paylaşabilirsin.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-300 break-all">
                  {publicPortfolioUrl || 'Profili kaydedince burada görünür.'}
                </div>
                <button
                  type="button"
                  onClick={copyPublicUrl}
                  disabled={!publicPortfolioUrl}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-xs text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-40"
                >
                  <Copy className="size-3.5" />
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-gradient-to-r from-indigo-500/25 to-violet-500/20 px-6 py-2.5 text-sm font-medium text-indigo-50 transition hover:border-indigo-300/50 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Bilgileri kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
