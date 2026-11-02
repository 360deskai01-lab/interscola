'use client';

import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { safeNextPath } from '@/lib/safe-next-path';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LogIn,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function resolvePostLoginDestination(
  role: string | undefined,
  nextPath: string | null,
): string {
  if (nextPath) {
    return nextPath;
  }
  if (role === 'admin') {
    return '/admin/dashboard';
  }
  if (role === 'teacher') {
    return '/teacher/dashboard';
  }
  if (role === 'student') {
    return '/student/dashboard';
  }
  return '/';
}

function LoginPageContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(translateAuthError(signInError.message));
        return;
      }

      /*
       * ÇEREZ SENKRONİZASYONU:
       * `signInWithPassword` oturumu tarayıcı çerezlerine yazar, ancak Next.js
       * client router ile yapılan geçişte sunucu bileşeni bazen çerezleri
       * görmeden çalışır ve 307 döngüsü oluşur. Bu yüzden:
       *   1. Önce router.refresh() ile sunucu tarafını tazeliyoruz.
       *   2. Sonra tam sayfa yönlendirme yapıyoruz (client router DEĞİL).
       */
      router.refresh();

      const role = signInData.user?.user_metadata?.role as string | undefined;
      window.location.href = resolvePostLoginDestination(role, nextPath);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Giriş yapılamadı. Lütfen tekrar dene.',
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
        className="pointer-events-none absolute -top-32 -left-24 size-[420px] rounded-full bg-indigo-600/30 blur-3xl"
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
          <h1 className="text-2xl font-semibold tracking-tight">Giriş Yap</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Denemelerin hesabına bağlansın diye giriş yap.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
              <span className="leading-relaxed">{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-3 pr-12 pl-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'
                  }
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
                <LogIn className="size-4" />
              )}
              {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Hesabın yok mu?{' '}
            <Link
              href="/auth/register"
              className="font-medium text-indigo-300 transition hover:text-indigo-200"
            >
              Kayıt Ol
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage(): ReactNode {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-slate-950 text-slate-400">
          <Loader2 className="size-8 animate-spin text-indigo-400" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

/** Supabase'in İngilizce hata mesajlarını anlaşılır Türkçeye çevirir. */
function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.';
  }
  return message;
}
