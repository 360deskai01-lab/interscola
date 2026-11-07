'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type {
  AssessmentPayload,
  EvaluationResult,
  ExamQuestion,
} from '@/types/exam';
import {
  type AttemptRecord,
  type ExamMode,
  type Phase,
  evaluationFromAttempt,
  examFromAttempt,
  isRecord,
  parseAttemptsPayload,
} from '@/lib/exam-shared';
import type { SessionUser } from '@/components/exam/AuthPanel';
import { Navbar } from '@/components/navigation/Navbar';
import type {
  NavbarAuthSnapshot,
  NavbarRole,
  NavbarStatus,
} from '@/components/navigation/nav-auth.types';
import { ExamCardList } from '@/components/exam/ExamCardList';
import {
  decorateExamForSessionFormat,
  resolveExamSessionDurationSeconds,
  defaultQuestionCountForHome,
  type ExamSessionFormatId,
} from '@/lib/exam/exam-session-formats';
import { HomeCompactHistory } from '@/components/home/HomeCompactHistory';
import { HomeGuestVitrine } from '@/components/home/HomeGuestVitrine';
import { HomeMemberWelcome } from '@/components/home/HomeMemberWelcome';
import { FeaturedUniversitiesCarousel } from '@/components/home/FeaturedUniversitiesCarousel';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { Footer } from '@/components/navigation/Footer';
import type { University } from '@/lib/universities/types';
import { ExamResults } from '@/components/exam/ExamResults';
import { ExamRunner } from '@/components/exam/ExamRunner';
import { ErrorCard, GlowOrb } from '@/components/exam/ui';

// ---------------------------------------------------------------------------
// API yardımcıları
// ---------------------------------------------------------------------------

function extractApiError(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error) {
    return payload.error;
  }
  return `Sunucu beklenmeyen bir yanıt döndürdü (${status}).`;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractApiError(payload, response.status));
  }

  return payload;
}

function pickExam(payload: unknown): AssessmentPayload {
  if (!isRecord(payload) || !isRecord(payload.exam)) {
    throw new Error('Sınav üretilemedi: yanıt beklenen biçimde değil.');
  }
  const exam = payload.exam;
  if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
    throw new Error('Sınav üretilemedi: hiç soru dönmedi.');
  }
  return exam as unknown as AssessmentPayload;
}

function pickEvaluation(payload: unknown): EvaluationResult {
  if (!isRecord(payload) || !isRecord(payload.evaluation)) {
    throw new Error('Değerlendirme alınamadı: yanıt beklenen biçimde değil.');
  }
  return payload.evaluation as unknown as EvaluationResult;
}

// ---------------------------------------------------------------------------
// Oturum
// ---------------------------------------------------------------------------

type UserRole = 'admin' | 'teacher' | 'student' | null;

interface SessionResult {
  user: SessionUser | null;
  role: UserRole;
  status: string | null;
  isCoordinatorPortal: boolean;
}

// ---------------------------------------------------------------------------
// Sayfa — yalnızca durum makinesi ve orkestrasyon
// ---------------------------------------------------------------------------

export interface HomePageClientProps {
  featuredUniversities?: University[];
  recentPublicLibraries?: { id: string; title: string; createdAt: string }[];
}

export default function HomePageClient({
  featuredUniversities = [],
  recentPublicLibraries = [],
}: HomePageClientProps) {
  // Aşama
  const [phase, setPhase] = useState<Phase>('home');

  // Mod seçimi
  const [activeMode, setActiveMode] = useState<ExamMode | null>(null);
  const [sessionFormat, setSessionFormat] =
    useState<ExamSessionFormatId>('diagnostic_drill');
  const [subject, setSubject] = useState('');
  const [questionCount, setQuestionCount] = useState(2);

  // Sınav / değerlendirme
  const [exam, setExam] = useState<AssessmentPayload | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finishedFast, setFinishedFast] = useState(false);
  /**
   * Karne geçmişten mi açıldı? Konfeti bu durumda tetiklenmemeli.
   * Taze sınav akışında `false`'a çekilir.
   */
  const [openedFromHistory, setOpenedFromHistory] = useState(false);

  // Arayüz
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AttemptRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [sessionCoordinatorPortal, setSessionCoordinatorPortal] =
    useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  const deadlineRef = useRef<number | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  const questions = exam?.questions ?? [];
  const question: ExamQuestion | undefined = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress =
    totalQuestions === 0 ? 0 : (currentIndex + 1) / totalQuestions;

  const requiresEveryAnswer = exam ? exam.engineType !== 'OBJECTIVE' : false;

  const unansweredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter(
      (item) => !(answers[item.id] ?? '').trim(),
    ).length;
  }, [exam, answers]);

  const answeredEvery = exam !== null && unansweredCount === 0;

  // --- Oturum ---------------------------------------------------------------

  const loadSession = useCallback(
    () =>
      fetch('/api/auth/session', { cache: 'no-store' })
        .then(async (response) => {
          const payload: unknown = await response.json().catch(() => null);
          const empty: SessionResult = {
            user: null,
            role: null,
            status: null,
            isCoordinatorPortal: false,
          };
          if (!response.ok || !isRecord(payload)) return empty;

          const rawRole = payload.role;
          const role: UserRole =
            rawRole === 'admin' ||
            rawRole === 'teacher' ||
            rawRole === 'student'
              ? rawRole
              : null;

          const rawStatus = payload.status;
          const status =
            typeof rawStatus === 'string' && rawStatus ? rawStatus : null;

          const user = payload.user;
          const isCoordinatorPortal =
            payload.isCoordinatorPortal === true;

          if (!isRecord(user) || typeof user.id !== 'string') {
            return { user: null, role, status, isCoordinatorPortal };
          }

          return {
            user: {
              id: user.id,
              email: typeof user.email === 'string' ? user.email : null,
            },
            role,
            status,
            isCoordinatorPortal,
          };
        })
        .catch(
          (): SessionResult => ({
            user: null,
            role: null,
            status: null,
            isCoordinatorPortal: false,
          }),
        )
        .then((result) => {
          setSessionUser(result.user);
          setSessionRole(result.role);
          setSessionStatus(result.status);
          setSessionCoordinatorPortal(result.isCoordinatorPortal);
          setSessionLoading(false);
        }),
    [],
  );

  // --- Geçmiş ---------------------------------------------------------------

  const loadHistory = useCallback(
    () =>
      fetch('/api/attempts?limit=5', { cache: 'no-store' })
        .then(async (response) => {
          const payload: unknown = await response.json().catch(() => null);
          return parseAttemptsPayload(payload, response.ok);
        })
        // Geçmiş ikincil bir özellik: hata kullanıcıya gösterilmez, liste boş kalır.
        .catch((): AttemptRecord[] => [])
        .then((attempts) => {
          setHistory(attempts);
          setHistoryLoading(false);
        }),
    [],
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    void loadHistory();
  }, [sessionUser, sessionLoading, loadHistory]);

  const signOut = useCallback(() => {
    void fetch('/api/auth/signout', { method: 'POST' })
      .catch(() => null)
      .then(() => {
        setSessionUser(null);
        setSessionRole(null);
        setSessionStatus(null);
        setHistory([]);
        setHistoryLoading(false);
      });
  }, []);

  // --- Navigasyon -----------------------------------------------------------

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(totalQuestions - 1, nextIndex));
      setDirection(clamped >= currentIndex ? 1 : -1);
      setCurrentIndex(clamped);
    },
    [currentIndex, totalQuestions],
  );

  const resetAll = useCallback(() => {
    setPhase('home');
    setExam(null);
    setEvaluation(null);
    setAnswers({});
    setCurrentIndex(0);
    setError(null);
    setActiveMode(null);
    setSecondsLeft(0);
    setFinishedFast(false);
    setOpenedFromHistory(false);
    deadlineRef.current = null;
    hasAutoSubmittedRef.current = false;
    if (sessionUser) {
      setHistoryLoading(true);
      void loadHistory();
    }
  }, [loadHistory, sessionUser]);

  /**
   * Sınav/karne ekranından çıkış. Kaybedilecek yanıt varsa onay ister.
   * Karne ekranında kayıp yok, bu yüzden orada soru sorulmaz.
   */
  const leaveExam = useCallback(() => {
    const leavingAnsweredExam =
      phase === 'exam' && Object.keys(answers).length > 0;

    if (leavingAnsweredExam) {
      const confirmed = window.confirm(
        'Sınavdan çıkmak istediğine emin misin? Verdiğin yanıtlar kaydedilmeyecek.',
      );
      if (!confirmed) return;
    }

    resetAll();
  }, [answers, phase, resetAll]);

  // --- Mod seçimi -----------------------------------------------------------

  const selectMode = useCallback(
    (mode: ExamMode) => {
      setActiveMode(mode);
      setSubject(mode.subjects[0]);
      setQuestionCount(
        defaultQuestionCountForHome(sessionFormat, mode.curriculum),
      );
    },
    [sessionFormat],
  );

  const selectSessionFormat = useCallback(
    (format: ExamSessionFormatId) => {
      setSessionFormat(format);
      if (activeMode) {
        setQuestionCount(
          defaultQuestionCountForHome(format, activeMode.curriculum),
        );
      }
    },
    [activeMode],
  );

  // --- Sınav üretimi --------------------------------------------------------

  const startExam = useCallback(
    async (mode: ExamMode) => {
      const chosenSubject = subject.trim() || mode.subjects[0];
      const count = Math.max(
        1,
        Math.min(mode.maxQuestions, questionCount || mode.defaultQuestions),
      );

      setActiveMode(mode);
      setError(null);
      setPhase('generating');
      setEvaluation(null);
      setAnswers({});
      setCurrentIndex(0);
      setFinishedFast(false);
      // Taze sınav: karne geldiğinde konfeti tetiklenmeli.
      setOpenedFromHistory(false);
      hasAutoSubmittedRef.current = false;

      try {
        const payload = await postJson('/api/generate-exam', {
          curriculum: mode.curriculum,
          subject: chosenSubject,
          engineType: mode.engineType,
          questionCount: count,
        });

        const rawExam = pickExam(payload);
        const nextExam = decorateExamForSessionFormat(
          rawExam,
          sessionFormat,
          mode.curriculum,
        );
        setExam(nextExam);
        setAnswers({});
        setCurrentIndex(0);
        setDirection(1);

        const totalSeconds = resolveExamSessionDurationSeconds(nextExam);
        deadlineRef.current = Date.now() + totalSeconds * 1000;
        setSecondsLeft(totalSeconds);
        setPhase('exam');
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Sınav üretilirken bir sorun oluştu.',
        );
        setPhase('home');
      }
    },
    [questionCount, sessionFormat, subject],
  );

  // --- Değerlendirme --------------------------------------------------------

  const finishExam = useCallback(async () => {
    if (!exam) return;

    const totalSeconds = resolveExamSessionDurationSeconds(exam);
    setFinishedFast(secondsLeft > totalSeconds / 2);

    setError(null);
    setPhase('grading');

    try {
      const payload = await postJson('/api/grade-exam', {
        exam,
        studentAnswers: answers,
      });
      setEvaluation(pickEvaluation(payload));
      setPhase('results');
      // Yeni deneme kaydedilmiş olabilir; geçmiş listesini tazele.
      if (sessionUser) {
        setHistoryLoading(true);
        void loadHistory();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Değerlendirme sırasında bir sorun oluştu.',
      );
      setPhase('exam');
    }
  }, [answers, exam, loadHistory, secondsLeft, sessionUser]);

  // --- Süre sayacı ----------------------------------------------------------

  useEffect(() => {
    if (phase !== 'exam' || deadlineRef.current === null) return;

    const update = () => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(
        0,
        Math.round((deadlineRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // --- Süre bitince otomatik gönderim ---------------------------------------

  useEffect(() => {
    if (phase !== 'exam') return;
    if (secondsLeft > 0) return;
    if (hasAutoSubmittedRef.current) return;

    hasAutoSubmittedRef.current = true;
    void finishExam();
  }, [finishExam, phase, secondsLeft]);

  // --- Klavye kısayolları (SAT) --------------------------------------------

  useEffect(() => {
    if (phase !== 'exam' || !exam || !question) return;
    if (exam.engineType !== 'OBJECTIVE') return;
    if (question.type !== 'multiple_choice') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const letter = event.key.toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(letter)) return;

      const optionCount = question.options?.length ?? 0;
      if (letter.charCodeAt(0) - 65 >= optionCount) return;

      event.preventDefault();
      setAnswers((prev) => ({ ...prev, [question.id]: letter }));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exam, phase, question]);

  // --- Geçmişten karne açma -------------------------------------------------

  const openAttempt = useCallback((attempt: AttemptRecord) => {
    setExam(examFromAttempt(attempt));
    setEvaluation(evaluationFromAttempt(attempt));
    setFinishedFast(false);
    setOpenedFromHistory(true);
    setError(null);
    setPhase('results');
  }, []);

  const retrySameMode = useCallback(() => {
    if (activeMode) void startExam(activeMode);
  }, [activeMode, startExam]);

  const navbarAuth = useMemo((): NavbarAuthSnapshot => {
    const role = sessionRole as NavbarRole | null;
    const status =
      sessionStatus === 'pending' ||
      sessionStatus === 'approved' ||
      sessionStatus === 'rejected'
        ? (sessionStatus as NavbarStatus)
        : null;
    return {
      user: sessionUser,
      role,
      status,
      isCoordinatorPortal: sessionCoordinatorPortal,
    };
  }, [sessionCoordinatorPortal, sessionRole, sessionStatus, sessionUser]);

  const showGuestHome = !sessionLoading && sessionUser === null;
  const showMemberHome = !sessionLoading && sessionUser !== null;
  const memberRoleForWelcome: 'admin' | 'teacher' | 'student' =
    sessionRole === 'admin' || sessionRole === 'teacher'
      ? sessionRole
      : 'student';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      {/* Arka plan */}
      <GlowOrb className="size-[520px] bg-indigo-600/40 -top-40 -left-32" delay={0} />
      <GlowOrb className="size-[460px] bg-fuchsia-600/30 top-1/3 -right-40" delay={2} />
      <GlowOrb className="size-[380px] bg-cyan-500/25 bottom-0 left-1/3" delay={4} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.25),transparent_60%)]"
      />

      {/* Lazer ilerleme çubuğu */}
      <AnimatePresence>
        {phase === 'exam' || phase === 'grading' ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-14 z-50 h-[3px] bg-white/5"
          >
            <motion.div
              className="relative h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            >
              <span className="absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-white/70 to-transparent blur-[2px]" />
              <span className="absolute top-1/2 right-0 size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_4px_rgba(255,255,255,0.65)]" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Navbar
        auth={navbarAuth}
        authLoading={sessionLoading}
        onClientSignOut={signOut}
      />

      <main className="relative mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Ana sayfaya dönüş — sınav ve karne aşamalarında */}
        <AnimatePresence>
          {phase !== 'home' && phase !== 'generating' ? (
            <motion.div
              key="back-home"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-6"
            >
              <button
                type="button"
                onClick={leaveExam}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
              >
                <span aria-hidden>←</span>
                Ana Sayfaya Dön
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {error ? (
            <ErrorCard message={error} onDismiss={() => setError(null)} />
          ) : null}
        </AnimatePresence>

        {/* Ana ekran */}
        {phase === 'home' ? (
          <motion.section
            key="home"
            id="interscola"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {showGuestHome ? <HomeGuestVitrine /> : null}

            {showMemberHome && sessionUser ? (
              <HomeMemberWelcome
                email={sessionUser.email}
                role={memberRoleForWelcome}
                status={sessionStatus}
              />
            ) : null}

            <div id="system" className="scroll-mt-24">
              {showGuestHome ? (
                <div className="mb-8 text-center sm:mb-10">
                  <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">
                    Hızlı teşhis — üç motoru dene
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
                    Diagnostic Drill veya Mini Deneme — resmi tam sınav değil;
                    kayıt olmadan hızlı seviye göstergesi alabilirsin.
                  </p>
                </div>
              ) : null}
              <ExamCardList
                activeMode={activeMode}
                sessionFormat={sessionFormat}
                subject={subject}
                questionCount={questionCount}
                recentPublicLibraries={recentPublicLibraries}
                onSelectMode={selectMode}
                onSelectSessionFormat={selectSessionFormat}
                onSelectSubject={setSubject}
                onSelectQuestionCount={setQuestionCount}
                onStart={(mode) => void startExam(mode)}
              />
            </div>

            {showMemberHome ? (
              <HomeCompactHistory
                attempts={history}
                loading={historyLoading}
                onOpen={openAttempt}
              />
            ) : null}

            {showGuestHome ? (
              <>
                <FeaturedUniversitiesCarousel
                  initialUniversities={featuredUniversities}
                />
                <TestimonialsSection />
              </>
            ) : null}

            <div id="cozumler-veli" className="sr-only" aria-hidden />
            <div id="cozumler-kurum" className="sr-only" aria-hidden />
            <div id="yetkinlik-envanteri" className="sr-only" aria-hidden />

            <Footer />
          </motion.section>
        ) : null}

        {/* Üretim / Değerlendirme bekleme */}
        {phase === 'generating' || phase === 'grading' ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="grid place-items-center py-24"
          >
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative grid size-16 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/25" />
                <span className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 blur-md" />
                <Loader2 className="relative size-8 animate-spin text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {phase === 'generating'
                    ? 'Sınav hazırlanıyor'
                    : 'Yanıtların değerlendiriliyor'}
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  {phase === 'generating'
                    ? 'Müfredat ve motor seçimine göre sorular üretiliyor.'
                    : 'Puanlama tamamlanınca karne ekranda belirecek.'}
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* Sınav */}
        {phase === 'exam' && exam && question ? (
          <ExamRunner
            exam={exam}
            question={question}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            answers={answers}
            secondsLeft={secondsLeft}
            direction={direction}
            requiresEveryAnswer={requiresEveryAnswer}
            answeredEvery={answeredEvery}
            unansweredCount={unansweredCount}
            onAnswer={(questionId, answer) =>
              setAnswers((prev) => ({ ...prev, [questionId]: answer }))
            }
            onNavigate={goTo}
            onFinish={() => void finishExam()}
          />
        ) : null}

        {/* Karne */}
        {phase === 'results' && exam && evaluation ? (
          <ExamResults
            exam={exam}
            evaluation={evaluation}
            finishedFast={finishedFast}
            answeredEvery={answeredEvery}
            isHistoryView={openedFromHistory}
            onRetry={retrySameMode}
            onHome={resetAll}
          />
        ) : null}

      </main>
    </div>
  );
}
