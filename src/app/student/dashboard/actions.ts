'use server';

/**
 * Öğrenci paneli komuta merkezi verisi (kariyer pusulası + üniversite barajları).
 * Uygulama `getStudentCommandCenterDataAction` üzerinden yüklenir; bu modül
 * dashboard katmanı için açık bir giriş noktası sağlar.
 */
export {
  getStudentCommandCenterDataAction as getStudentDashboardDataAction,
} from '@/app/student/command-center-data';

export type {
  StudentCareerSnapshot,
  StudentCommandCenterData,
} from '@/lib/student-command-center/types';

export type { UniversityThresholdProgress } from '@/lib/student-dashboard/university-threshold-progress';
