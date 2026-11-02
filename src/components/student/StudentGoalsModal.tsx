'use client';

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Target,
  X,
} from 'lucide-react';
import {
  formatJoinCodeFieldInput,
  JOIN_CODE_FIELD_MAX_LENGTH,
  JOIN_CODE_LENGTH,
  JOIN_CODE_PATTERN,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import type {
  JoinOrganizationResult,
  StudentGoalsContext,
  UpdateStudentGoalsPayload,
} from '@/lib/student-profile/types';

type GoalsTab = 'academic' | 'organization';

interface StudentGoalsModalProps {
  open: boolean;
  context: StudentGoalsContext;
  onClose: () => void;
  onSaveGoals: (
    payload: UpdateStudentGoalsPayload,
  ) => Promise<{ success: boolean; error?: string }>;
  onJoinOrganization: (joinCode: string) => Promise<JoinOrganizationResult>;
  onJoined?: (result: JoinOrganizationResult) => void;
}

function scoreInputValue(
  scores: StudentGoalsContext['targetScores'],
  key: 'SAT' | 'IELTS',
): string {
  const raw = scores[key];
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

export function StudentGoalsModal({
  open,
  context,
  onClose,
  onSaveGoals,
  onJoinOrganization,
  onJoined,
}: StudentGoalsModalProps): ReactNode {
  const [tab, setTab] = useState<GoalsTab>('academic');
  const [satTarget, setSatTarget] = useState('');
  const [ieltsTarget, setIeltsTarget] = useState('');
  const [selectedUniversityIds, setSelectedUniversityIds] = useState<string[]>(
    [],
  );
  const [universityQuery, setUniversityQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [orgLink, setOrgLink] = useState(context.organization);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSaveTransition] = useTransition();
  const [joinPending, startJoinTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSatTarget(scoreInputValue(context.targetScores, 'SAT'));
    setIeltsTarget(scoreInputValue(context.targetScores, 'IELTS'));
    setSelectedUniversityIds([...context.targetUniversityIds]);
    setOrgLink(context.organization);
    setJoinCode('');
    setFeedback(null);
    setError(null);
    setTab('academic');
  }, [open, context]);

  const filteredUniversities = useMemo(() => {
    const q = universityQuery.trim().toLowerCase();
    if (!q) return context.universities;
    return context.universities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q) ||
        (u.city?.toLowerCase().includes(q) ?? false),
    );
  }, [context.universities, universityQuery]);

  if (!open) return null;

  function toggleUniversity(id: string) {
    setSelectedUniversityIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleSaveGoals() {
    setError(null);
    setFeedback(null);

    const targetScores: UpdateStudentGoalsPayload['targetScores'] = {};
    if (satTarget.trim()) targetScores.SAT = satTarget.trim();
    if (ieltsTarget.trim()) targetScores.IELTS = ieltsTarget.trim();

    startSaveTransition(async () => {
      const result = await onSaveGoals({
        targetScores,
        targetUniversityIds: selectedUniversityIds,
      });
      if (!result.success) {
        setError(result.error ?? 'Hedefler kaydedilemedi.');
        return;
      }
      setFeedback('Akademik hedeflerin kaydedildi.');
    });
  }

  function handleJoinOrganization() {
    setError(null);
    setFeedback(null);

    const cleanCode = normalizeJoinCodeInput(joinCode);
    if (!JOIN_CODE_PATTERN.test(cleanCode)) {
      setError(
        `Katılım kodu ${JOIN_CODE_LENGTH} karakter olmalıdır (ör. FAV-B82 veya TED-26).`,
      );
      return;
    }

    startJoinTransition(async () => {
      const result = await onJoinOrganization(cleanCode);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setFeedback(result.message);
      if (result.orgName) {
        setOrgLink({
          organizationId: '',
          orgName: result.orgName,
        });
      }
      setJoinCode('');
      onJoined?.(result);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-goals-title"
    >
      <div className="flex max-h-[min(92dvh,760px)] w-full max-w-2xl flex-col rounded-t-3xl border border-indigo-400/20 bg-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-500/20">
            <Target className="size-5 text-indigo-200" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="student-goals-title"
              className="text-base font-semibold text-slate-50"
            >
              Hedeflerim & Kurum Bağlantısı
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hedef skorlarını ve okul kodunu buradan güncelle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-4 pt-2">
          <button
            type="button"
            onClick={() => setTab('academic')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              tab === 'academic'
                ? 'bg-indigo-500/15 text-indigo-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Akademik Hedeflerim
          </button>
          <button
            type="button"
            onClick={() => setTab('organization')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              tab === 'organization'
                ? 'bg-indigo-500/15 text-indigo-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Kurum / Okul Bağlantısı
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p
              role="status"
              className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
            >
              {feedback}
            </p>
          ) : null}

          {tab === 'academic' ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    Digital SAT hedefi
                  </span>
                  <input
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    value={satTarget}
                    onChange={(e) => setSatTarget(e.target.value)}
                    placeholder="Örn: 1450"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    IELTS Academic hedefi
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    step={0.5}
                    value={ieltsTarget}
                    onChange={(e) => setIeltsTarget(e.target.value)}
                    placeholder="Örn: 7.5"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-sky-300" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    Hedef üniversiteler
                  </h3>
                </div>
                <input
                  type="search"
                  value={universityQuery}
                  onChange={(e) => setUniversityQuery(e.target.value)}
                  placeholder="Bocconi, TUM, Oxford…"
                  className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                />
                <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  {filteredUniversities.length === 0 ? (
                    <li className="px-2 py-3 text-center text-xs text-slate-500">
                      Eşleşen üniversite yok.
                    </li>
                  ) : (
                    filteredUniversities.map((university) => {
                      const checked = selectedUniversityIds.includes(
                        university.id,
                      );
                      return (
                        <li key={university.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUniversity(university.id)}
                              className="mt-1 size-4 rounded border-white/20 bg-slate-950 text-indigo-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-100">
                                {university.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {university.city
                                  ? `${university.city}, ${university.country}`
                                  : university.country}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {orgLink ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4">
                  <Building2 className="size-5 shrink-0 text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">
                      {orgLink.orgName}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                      <CheckCircle2 className="size-3.5" />
                      Bağlandı
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-400">
                    Okulunun veya danışmanının verdiği katılım kodunu gir
                    (harf, rakam ve tire):
                  </p>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={JOIN_CODE_FIELD_MAX_LENGTH}
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(formatJoinCodeFieldInput(e.target.value))
                    }
                    placeholder="Örn: FAV-B82 veya TED-26"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-center font-mono text-lg tracking-wider text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                  <button
                    type="button"
                    disabled={joinPending}
                    onClick={handleJoinOrganization}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {joinPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Kuruma Bağlan
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.05]"
          >
            Kapat
          </button>
          {tab === 'academic' ? (
            <button
              type="button"
              disabled={savePending}
              onClick={handleSaveGoals}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
            >
              {savePending ? <Loader2 className="size-4 animate-spin" /> : null}
              Hedefleri Kaydet
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
