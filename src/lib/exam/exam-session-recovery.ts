const STORAGE_VERSION = 1 as const;

export interface ExamSessionRecoverySnapshot {
  version: typeof STORAGE_VERSION;
  answers: Record<string, string>;
  currentIndex: number;
  /** Kalan süre hesabı için bitiş zamanı (ms). */
  deadlineAt: number;
  savedAt: string;
}

export function examSessionStorageKey(assignmentId: string): string {
  return `exam_session_${assignmentId.trim()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readExamSessionRecovery(
  assignmentId: string,
): ExamSessionRecoverySnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(examSessionStorageKey(assignmentId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) return null;
    if (!isRecord(parsed.answers)) return null;
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.answers)) {
      if (typeof value === 'string') answers[key] = value;
    }
    const currentIndex =
      typeof parsed.currentIndex === 'number' && Number.isFinite(parsed.currentIndex)
        ? Math.max(0, Math.floor(parsed.currentIndex))
        : 0;
    const deadlineAt =
      typeof parsed.deadlineAt === 'number' && Number.isFinite(parsed.deadlineAt)
        ? parsed.deadlineAt
        : Date.now();
    return {
      version: STORAGE_VERSION,
      answers,
      currentIndex,
      deadlineAt,
      savedAt:
        typeof parsed.savedAt === 'string'
          ? parsed.savedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeExamSessionRecovery(
  assignmentId: string,
  snapshot: Omit<ExamSessionRecoverySnapshot, 'version' | 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ExamSessionRecoverySnapshot = {
      version: STORAGE_VERSION,
      answers: snapshot.answers,
      currentIndex: snapshot.currentIndex,
      deadlineAt: snapshot.deadlineAt,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      examSessionStorageKey(assignmentId),
      JSON.stringify(payload),
    );
  } catch {
    /* depolama kotası / gizli mod */
  }
}

export function clearExamSessionRecovery(assignmentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(examSessionStorageKey(assignmentId));
  } catch {
    /* yoksay */
  }
}

/** Bozuk veya süresi dolmuş kurtarma kayıtlarını ayıklamak için alt eşik (sn). */
export const MIN_TRUSTED_RECOVERY_REMAINING_SECONDS = 60;

export function remainingSecondsUntilDeadline(
  deadlineAt: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.round((deadlineAt - nowMs) / 1000));
}

export type ExamSessionRecoveryTiming = {
  /** Kurtarma snapshot'ı güvenilir kabul edildi mi */
  trustRecoverySnapshot: boolean;
  /** Oturum sayacına verilecek kalan / tam süre (sn) */
  sessionSeconds: number;
  /** deadlineAt (ms); güvenilir kurtarmada snapshot'tan, değilse yeni oturum */
  deadlineAt: number;
};

/**
 * Kurtarılan deadline çok kısa ise (ör. dakika/saniye karışımı) kaydı çöpe atıp
 * tam resmi süreyi döndürür. Aksi halde kurtarma deadline'ını kullanır.
 */
export function resolveExamSessionRecoveryTiming(
  recovered: ExamSessionRecoverySnapshot | null,
  officialTotalSeconds: number,
  nowMs: number = Date.now(),
): ExamSessionRecoveryTiming {
  const fallbackDeadline = nowMs + officialTotalSeconds * 1000;
  if (!recovered) {
    return {
      trustRecoverySnapshot: false,
      sessionSeconds: officialTotalSeconds,
      deadlineAt: fallbackDeadline,
    };
  }

  const remaining = remainingSecondsUntilDeadline(recovered.deadlineAt, nowMs);
  if (remaining < MIN_TRUSTED_RECOVERY_REMAINING_SECONDS) {
    return {
      trustRecoverySnapshot: false,
      sessionSeconds: officialTotalSeconds,
      deadlineAt: fallbackDeadline,
    };
  }

  return {
    trustRecoverySnapshot: true,
    sessionSeconds: remaining,
    deadlineAt: recovered.deadlineAt,
  };
}
