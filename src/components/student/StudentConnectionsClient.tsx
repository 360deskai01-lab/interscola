'use client';

import Link from 'next/link';
import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  School,
  Shield,
  UserRound,
} from 'lucide-react';
import type { LinkedTeacher } from '@/app/student/actions';
import type { JoinOrganizationResult, StudentOrganizationLink } from '@/lib/student-profile/types';
import { claimInviteFormAction } from '@/app/student/actions';
import {
  joinOrganizationByCodeAction,
  regenerateStudentObserverTokenAction,
} from '@/app/student/profile-actions';
import { absoluteUrl } from '@/lib/seo/site-url';
import {
  JOIN_CODE_LENGTH,
  JOIN_CODE_PATTERN,
  formatJoinCodeFieldInput,
  JOIN_CODE_FIELD_MAX_LENGTH,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import { StudentHubNav } from '@/components/student/StudentHubNav';

interface StudentConnectionsClientProps {
  teachers: LinkedTeacher[];
  organization: StudentOrganizationLink | null;
  /** Boş: henüz atanmamış token; "Yenile" ile üretilebilir. */
  observerToken: string;
}

export function StudentConnectionsClient({
  teachers,
  organization: initialOrg,
  observerToken: initialToken,
}: StudentConnectionsClientProps): ReactNode {
  const [organization, setOrganization] = useState(initialOrg);
  const [observerToken, setObserverToken] = useState(initialToken);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [claimPending, startClaim] = useTransition();
  const [joinPending, startJoin] = useTransition();
  const [rotatePending, startRotate] = useTransition();

  const observerUrl = useMemo(() => {
    const t = observerToken.trim();
    if (!t) return '';
    return absoluteUrl(`/observe/${t}`);
  }, [observerToken]);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError('Panoya kopyalanamadı.');
    }
  }

  function handleClaimInvite() {
    setError(null);
    setSuccess(null);
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Geçerli bir davet kodu gir.');
      return;
    }
    startClaim(async () => {
      const result = await claimInviteFormAction(code);
      if (!result.success) {
        setError(result.error ?? 'Davet işlenemedi.');
        return;
      }
      setSuccess(
        result.teacherName
          ? `${result.teacherName} ile bağlantı kuruldu.`
          : 'Eğitmen bağlantısı oluşturuldu.',
      );
      setInviteCode('');
    });
  }

  function handleJoinOrg() {
    setError(null);
    setSuccess(null);
    const clean = normalizeJoinCodeInput(joinCode);
    if (!JOIN_CODE_PATTERN.test(clean)) {
      setError(
        `Katılım kodu ${JOIN_CODE_LENGTH} karakter olmalıdır (ör. FAV-B82).`,
      );
      return;
    }
    startJoin(async () => {
      const result: JoinOrganizationResult =
        await joinOrganizationByCodeAction(clean);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
      if (result.orgName) {
        setOrganization({
          organizationId: organization?.organizationId ?? '',
          orgName: result.orgName,
        });
      }
      setJoinCode('');
    });
  }

  function handleRotateObserver() {
    setError(null);
    setSuccess(null);
    startRotate(async () => {
      const result = await regenerateStudentObserverTokenAction();
      if (!result.success || !result.token) {
        setError(result.error ?? 'Bağlantı yenilenemedi.');
        return;
      }
      setObserverToken(result.token);
      setSuccess('Veli takip bağlantısı yenilendi. Eski link artık geçersiz.');
    });
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_60%_-15%,rgba(168,85,247,0.1),transparent_58%)]"
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
              🤝
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Bağlantılarım
              </h1>
              <p className="text-xs text-slate-500">
                Eğitmenler, kurum ve veli erişimi.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <StudentHubNav currentHref="/student/connections" />

          <div className="min-w-0 flex-1 space-y-6">
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
                className="flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                {success}
              </div>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>
                  👨‍🏫
                </span>
                <h2 className="text-sm font-medium text-slate-200">
                  Eğitmenlerim
                </h2>
              </div>
              {teachers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Henüz bağlı eğitmen yok. Öğretmeninden aldığın kodu aşağıya
                  gir.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {teachers.map((t) => (
                    <li
                      key={t.linkId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <UserRound className="size-4 shrink-0 text-indigo-300" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">
                            {t.fullName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {t.email}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-xs text-slate-500">
                  Öğretmen davet kodu
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(e.target.value.toUpperCase())
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-400/40"
                    placeholder="XXXX…"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleClaimInvite}
                  disabled={claimPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/35 bg-indigo-500/15 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-60"
                >
                  {claimPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Bağlan
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>
                  🏛️
                </span>
                <h2 className="text-sm font-medium text-slate-200">
                  Kurum & kampüs bağlantısı
                </h2>
              </div>
              {organization ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                  <School className="size-4" />
                  {organization.orgName}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Okulunun verdiği 6 haneli katılım kodunu gir.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-xs text-slate-500">
                  Katılım kodu
                  <input
                    type="text"
                    value={joinCode}
                    maxLength={JOIN_CODE_FIELD_MAX_LENGTH}
                    onChange={(e) =>
                      setJoinCode(
                        formatJoinCodeFieldInput(e.target.value).toUpperCase(),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 font-mono text-sm tracking-widest outline-none transition focus:border-indigo-400/40"
                    placeholder="● ● ● ● ● ●"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleJoinOrg}
                  disabled={joinPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm text-slate-100 transition hover:bg-white/[0.1] disabled:opacity-60"
                >
                  {joinPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Building2 className="size-4" />
                  )}
                  Kuruma katıl
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg" aria-hidden>
                  👪
                </span>
                <h2 className="text-sm font-medium text-slate-200">
                  Veli & gözlemci erişimi
                </h2>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                  <Shield className="size-3" />
                  Salt okunur
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Bu bağlantıyı güvenilir bir veli veya gözlemci ile paylaş.
                Yenilediğinde eski bağlantı geçersiz olur.
              </p>
              {!observerUrl ? (
                <p className="mt-3 text-xs text-amber-200/90">
                  Gözlemci bağlantın henüz oluşturulmadı. Aşağıdaki
                  &quot;Yenile&quot; ile güvenli bir link üretebilirsin.
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-300 break-all">
                  {observerUrl ||
                    'Bağlantı oluşturulunca burada görünecek.'}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('obs', observerUrl)}
                    disabled={!observerUrl}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="size-3.5" />
                    {copiedKey === 'obs' ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateObserver}
                    disabled={rotatePending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
                    title="Yeni güvenli bağlantı üret"
                  >
                    {rotatePending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Yenile
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
