import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

async function readTeachingExpertise(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  const client = admin ?? (await getSupabaseServer(PROFILES_SCHEMA));
  if (!client) return null;
  let { data, error } = await client
    .from('profiles')
    .select('teaching_expertise')
    .eq('id', userId)
    .maybeSingle();

  if (error?.code === '42703') return null;
  if (error || !data) return null;
  const raw = (data as { teaching_expertise?: string | null }).teaching_expertise;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * Öğretmen akademik profil özeti (FAZ D.4).
 * Uzun vadede düzenlenebilir form eklenebilir; şimdilik salt okunur gösterim.
 */
export default async function TeacherProfilePage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) {
    redirect('/auth/login');
  }

  if (
    current.profile.status !== 'approved' ||
    (current.profile.role !== 'teacher' && current.profile.role !== 'admin')
  ) {
    redirect('/');
  }

  const expertise = await readTeachingExpertise(current.user.id ?? '');

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.18),transparent_60%)]"
      />

      <NavbarServer />
      <div className="relative mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-slate-950 shadow-lg shadow-violet-900/40">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Eğitmen Profilim
            </h1>
            <p className="text-xs text-slate-500">{current.user.email}</p>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Görünen ad
            </p>
            <p className="mt-1 text-sm text-slate-100">
              {current.profile.full_name?.trim() || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Uzmanlık / branş
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {expertise ??
                'Henüz tanımlı değil. Veritabanında profiles.teaching_expertise alanı doldurulduğunda burada görünür.'}
            </p>
          </div>
        </div>

        <p className="mt-8 text-center">
          <Link
            href="/teacher/dashboard"
            className="text-sm text-violet-300 underline-offset-4 hover:underline"
          >
            ← Öğretmen paneline dön
          </Link>
        </p>
      </div>
    </div>
  );
}
