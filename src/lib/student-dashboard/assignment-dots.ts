import type { StudentAssignment } from '@/app/student/actions';

const FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000;

export type AssignmentSidebarDot = 'none' | 'red' | 'amber';

/**
 * Öğrenci sidebar: Ödevler sekmesi için öncelik (kırmızı > sarı).
 */
export function computeAssignmentSidebarDot(
  assignments: StudentAssignment[],
): AssignmentSidebarDot {
  const now = Date.now();
  let hasAmber = false;

  for (const a of assignments) {
    const assignedMs = new Date(a.assignedAt).getTime();
    const dueMs =
      a.dueDate != null && String(a.dueDate).trim()
        ? new Date(a.dueDate).getTime()
        : NaN;
    const hasDue = Number.isFinite(dueMs);

    if (a.status === 'assigned') {
      if (now - assignedMs <= FORTY_EIGHT_H_MS) {
        return 'red';
      }
      if (
        hasDue &&
        dueMs >= now &&
        dueMs - now <= FORTY_EIGHT_H_MS
      ) {
        hasAmber = true;
      }
    }

    if (a.status === 'in_progress') {
      hasAmber = true;
      continue;
    }

    if (
      hasDue &&
      a.status !== 'completed' &&
      dueMs >= now &&
      dueMs - now <= FORTY_EIGHT_H_MS
    ) {
      hasAmber = true;
    }
  }

  return hasAmber ? 'amber' : 'none';
}
