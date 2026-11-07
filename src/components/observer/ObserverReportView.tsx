import { Award, GraduationCap, ShieldCheck, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ObserverReportData } from '@/lib/observer/load-observer-data';
import { ObserverScoreRunwaySummary } from '@/components/observer/ObserverScoreRunwaySummary';
import type { ActivityCategory } from '@/lib/student-portfolio/types';

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  leadership: 'Liderlik',
  community_service: 'Topluma hizmet',
  athletics: 'Spor',
  arts_music: 'Sanat & müzik',
  academic_competitions: 'Akademik yarışma',
  internship_work: 'Staj / iş deneyimi',
  other: 'Diğer',
};

function formatReportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatAttemptDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function ObserverReportView({ data }: { data: ObserverReportData }): ReactNode {
  const { profile, kpis, runwayBundle, recentAttempts, highlightActivities } =
    data;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-15%,rgba(56,189,248,0.14),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-12 print:max-w-none print:px-8">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                İnterscola · Güvenli Gözlemci Kanalı
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Öğrenci Gelişim & Takip Raporu
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Veli / Gözlemci Görünümü
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
              <ShieldCheck className="size-5 text-emerald-300" aria-hidden />
              <span className="text-xs font-medium text-emerald-100">
                İnterscola Güvenlik Mührü
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Rapor anı: {formatReportDate(data.generatedAt)}
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 size-5 text-indigo-300" />
            <div>
              <p className="text-xs text-slate-500 uppercase">Öğrenci özeti</p>
              <p className="text-lg font-semibold text-white">
                {profile.displayName}
              </p>
              {profile.highSchoolName ? (
                <p className="mt-1 text-sm text-slate-400">
                  {profile.highSchoolName}
                  {profile.graduationYear
                    ? ` · Mezuniyet ${profile.graduationYear}`
                    : ''}
                </p>
              ) : null}
              {profile.curriculumLabels.length > 0 ? (
                <p className="mt-2 text-sm text-slate-300">
                  Hedef müfredat: {profile.curriculumLabels.join(' · ')}
                </p>
              ) : null}
              {profile.pinnedUniversityNames.length > 0 ? (
                <p className="mt-1 text-sm text-slate-400">
                  Hedef üniversiteler:{' '}
                  {profile.pinnedUniversityNames.join(', ')}
                </p>
              ) : null}
              {profile.interestTags.length > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  İlgi alanları: {profile.interestTags.slice(0, 8).join(', ')}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="En son SAT"
            value={
              kpis.latestSat !== null
                ? `${Math.round(kpis.latestSat)} /1600`
                : '—'
            }
          />
          <KpiCard
            label="En son IELTS"
            value={
              kpis.latestIelts !== null
                ? `Band ${kpis.latestIelts.toFixed(1)}`
                : '—'
            }
          />
          <KpiCard
            label="Çözülen deneme"
            value={String(kpis.attemptCount)}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="size-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-slate-100">
              Score Runway özeti (aylık koşu)
            </h2>
          </div>
          <ObserverScoreRunwaySummary bundle={runwayBundle} />
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-semibold text-slate-200">
            Son deneme skor dökümü
          </h2>
          {recentAttempts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Henüz kayıtlı deneme sonucu yok.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/5">
              {recentAttempts.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200">{row.examTitle}</p>
                    <p className="text-xs text-slate-500">
                      {row.curriculum} · {formatAttemptDate(row.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-cyan-100">
                    {row.scaledResult}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-violet-300" />
            <h2 className="text-sm font-semibold text-slate-200">
              Portfolyo & aktivite özeti
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              {data.activityCount} kayıt
            </span>
          </div>
          {highlightActivities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Onaylı ders dışı aktivite kaydı henüz yok.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {highlightActivities.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/8 bg-slate-900/40 px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-100">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {CATEGORY_LABELS[item.category]}
                    {item.organization ? ` · ${item.organization}` : ''}
                    {item.role ? ` · ${item.role}` : ''}
                  </p>
                  {item.impactDescription ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {item.impactDescription}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-8 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100/95">
          Bu sayfa yalnızca yetkili gözlemciler için hazırlanmış anlık ve salt
          okunur akademik takip belgesidir. Düzenleme veya giriş yapılamaz.
        </footer>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}
