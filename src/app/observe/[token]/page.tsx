import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { getSupabasePublicAnon } from '@/lib/supabase/public-anon';

export const instant = false;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `public.get_observer_snapshot` dönüşü (yalnızca güvenli alanlar). */
interface ObserverSnapshot {
  display_name: string;
  high_school_name: string | null;
  graduation_year: number | null;
  activity_count: number;
}

function Unavailable({ message }: { message: string }): ReactNode {
  return (
    <div className="min-h-dvh bg-slate-950 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export default async function ObserveStudentPage(props: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  await connection();

  const { token } = await props.params;
  if (!UUID_PATTERN.test(token)) notFound();

  // Anonim istemci + SECURITY DEFINER RPC: `profiles` tablosuna doğrudan anon erişimi yok.
  const client = getSupabasePublicAnon('public');
  if (!client) {
    return <Unavailable message="Gözlemci görünümü şu an kullanılamıyor." />;
  }

  const { data, error } = await client.rpc('get_observer_snapshot', {
    p_token: token,
  });

  if (error) {
    console.error('[observe] RPC hatası:', error.code, error.message);
    // PGRST202: fonksiyon henüz migrate edilmemiş.
    return <Unavailable message="Gözlemci görünümü şu an kullanılamıyor." />;
  }
  if (!data) notFound();

  const snapshot = data as ObserverSnapshot;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(34,197,94,0.12),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-lg px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <ShieldCheck className="size-6 text-emerald-300" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-300/90 uppercase">
              Veli / gözlemci
            </p>
            <h1 className="text-lg font-semibold text-white">Güvenli takip</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 size-5 shrink-0 text-indigo-300" />
            <div>
              <p className="text-sm text-slate-400">Öğrenci</p>
              <p className="text-lg font-semibold text-white">
                {snapshot.display_name}
              </p>
              {snapshot.high_school_name ? (
                <p className="mt-1 text-sm text-slate-400">
                  {snapshot.high_school_name}
                  {snapshot.graduation_year
                    ? ` · Mezuniyet ${snapshot.graduation_year}`
                    : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">Özet</p>
            <p className="mt-2 text-sm text-slate-300">
              Aktivite & portfolyo kaydı:{' '}
              <span className="font-medium text-slate-100">
                {snapshot.activity_count} giriş
              </span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Bu sayfa yalnızca paylaşılan bağlantı ile açılır. Giriş veya
              düzenleme yapılamaz; detaylar panelden öğrenci tarafından
              yönetilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
