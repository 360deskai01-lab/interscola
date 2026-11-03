'use client';

import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ListChecks,
  Loader2,
  PenLine,
  UserPlus,
  Users,
} from 'lucide-react';
import type { CurriculumCode } from '@/types/exam';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Supabase şifre politikasıyla uyumlu asgari uzunluk. */
const MIN_PASSWORD_LENGTH = 6;

type Role = 'student' | 'teacher';

interface CurriculumOption {
  code: CurriculumCode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Öğrenci kaydında seçilebilen hedef sınavlar. */
const CURRICULUM_OPTIONS: readonly CurriculumOption[] = [
  { code: 'SAT', label: 'Digital SAT', icon: ListChecks },
  { code: 'IELTS', label: 'IELTS Academic', icon: PenLine },
  { code: 'CAIE', label: 'CAIE A-Level', icon: BookOpen },
];

function resolvePostRegisterDestination(
  role: string | undefined,
  nextPath: string | null,
): string {
  if (nextPath) return nextPath;
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'student') return '/student/dashboard';
  return '/';
}

function RegisterPageContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const loginHref = nextPath
    ? `/auth/login?next=${encodeURIComponent(nextPath)}`
    : '/auth/login';

  const [role, setRole] = useState<Role>('student');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedCurriculums, setSelectedCurriculums] = useState<
    CurriculumCode[]
  >([]);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchRole(next: Role) {
    if (next === role) return;
    setRole(next);
    // Rol değişince önceki role ait doğrulama mesajları anlamsız kalır.
    setError(null);
    setInfo(null);
  }

  function toggleCurriculum(code: CurriculumCode) {
    setSelectedCurriculums((previous) =>
      previous.includes(code)
        ? previous.filter((item) => item !== code)
        : [...previous, code],
    );
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setInfo(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('Lütfen ad ve soyadını gir.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }
    if (role === 'student' && selectedCurriculums.length === 0) {
      setError('En az bir hedef sınav seçmelisin.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      /*
       * Metadata rolü belirler. Öğrencide seçilen müfredatlar da gönderilir;
       * öğretmende branş opsiyonel olduğu için yalnızca doluysa eklenir.
       */
      const metadata =
        role === 'student'
          ? {
              full_name: trimmedName,
              role: 'student' as const,
              selected_curriculums: selectedCurriculums,
            }
          : {
              full_name: trimmedName,
              role: 'teacher' as const,
              ...(specialization.trim()
                ? { specialization: specialization.trim() }
                : {}),
            };

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: metadata },
      });

      if (signUpError) {
        setError(translateAuthError(signUpError.message));
        return;
      }

      /*
       * Supabase e-posta doğrulaması açıksa `session` null gelir: kullanıcı
       * henüz giriş yapmış sayılmaz. Bu durumda ana sayfaya göndermek yanıltıcı
       * olur; kullanıcıya e-postasını doğrulaması gerektiği söylenir.
       */
      if (!data.session) {
        setInfo(
          'Kayıt alındı. Giriş yapabilmek için e-posta adresine gelen ' +
            'doğrulama bağlantısına tıkla.',
        );
        return;
      }

      router.refresh();
      const roleMeta = data.user?.user_metadata?.role as string | undefined;
      window.location.href = resolvePostRegisterDestination(roleMeta, nextPath);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Kayıt tamamlanamadı. Lütfen tekrar dene.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-950 px-5 py-12 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,102,241,0.25),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full bg-fuchsia-600/25 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3 transition hover:opacity-90"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-indigo-900/40">
            <GraduationCap className="size-6" />
          </span>
          <span className="text-left">
            <span className="block text-lg font-semibold tracking-tight">
              Interscola
            </span>
            <span className="block text-xs text-slate-500">
              Uluslararası sınav hazırlığı
            </span>
          </span>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_20px_70px_-30px_rgba(79,70,229,0.6)] backdrop-blur-xl">
          <h1 className="text-2xl font-semibold tracking-tight">Kayıt Ol</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Hesabını oluştur, denemelerin kaydedilsin.
          </p>

          {/* Rol sekmeleri */}
          <div
            role="tablist"
            aria-label="Kayıt türü"
            className="relative mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-slate-950/60 p-1"
          >
            <RoleTab
              active={role === 'student'}
              label="Öğrenci Kaydı"
              icon={Users}
              onSelect={() => switchRole('student')}
            />
            <RoleTab
              active={role === 'teacher'}
              label="Öğretmen Kaydı"
              icon={GraduationCap}
              onSelect={() => switchRole('teacher')}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
              <span className="leading-relaxed">{error}</span>
            </div>
          ) : null}

          {info ? (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3.5 text-sm leading-relaxed text-emerald-100"
            >
              {info}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="fullName"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Ad Soyad
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ad Soyad"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                E-posta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@eposta.com"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            {/* Öğretmene özgü alan */}
            <motion.div
              initial={false}
              animate={{
                opacity: role === 'teacher' ? 1 : 0,
                height: role === 'teacher' ? 'auto' : 0,
              }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
              aria-hidden={role !== 'teacher'}
            >
              <label
                htmlFor="specialization"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Branş / Uzmanlık{' '}
                <span className="font-normal text-slate-500">(opsiyonel)</span>
              </label>
              <input
                id="specialization"
                type="text"
                tabIndex={role === 'teacher' ? 0 : -1}
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value)}
                placeholder="Örn: Matematik, Psikoloji"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
              />
            </motion.div>

            {/* Öğrenciye özgü alan */}
            <motion.div
              initial={false}
              animate={{
                opacity: role === 'student' ? 1 : 0,
                height: role === 'student' ? 'auto' : 0,
              }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
              aria-hidden={role !== 'student'}
            >
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Hedef Sınavlar
              </span>
              <div className="flex flex-wrap gap-2">
                {CURRICULUM_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = selectedCurriculums.includes(option.code);

                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => toggleCurriculum(option.code)}
                      aria-pressed={selected}
                      tabIndex={role === 'student' ? 0 : -1}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${
                        selected
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="size-4" />
                      {option.label}
                      {selected ? (
                        <CheckCircle2 className="size-3.5 text-indigo-300" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                En az bir sınav seçmelisin.
              </p>
            </motion.div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="En az 6 karakter"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-3 pr-12 pl-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={showPassword}
                  tabIndex={0}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-500 transition hover:text-slate-200 focus-visible:text-indigo-300 focus-visible:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {submitting
                ? 'Hesap oluşturuluyor…'
                : role === 'student'
                  ? 'Öğrenci Olarak Kayıt Ol'
                  : 'Öğretmen Olarak Kayıt Ol'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Zaten hesabın var mı?{' '}
            <Link
              href={loginHref}
              className="font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              Giriş Yap
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function RegisterPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-400">
          Kayıt formu yükleniyor…
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Rol sekmesi
// ---------------------------------------------------------------------------

function RoleTab({
  active,
  label,
  icon: Icon,
  onSelect,
}: {
  active: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="role-tab-bg"
          className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 shadow-lg shadow-indigo-900/30"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      ) : null}
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/** Supabase'in İngilizce hata mesajlarını anlaşılır Türkçeye çevirir. */
function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'Bu e-posta adresiyle bir hesap zaten var. Giriş yapmayı dene.';
  }
  if (lower.includes('password')) {
    return 'Şifre bu politikaya uymuyor. En az 6 karakter kullan.';
  }
  if (lower.includes('invalid email') || lower.includes('email address')) {
    return 'Geçerli bir e-posta adresi gir.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.';
  }
  return message;
}
