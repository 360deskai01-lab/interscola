'use server';

import {
  getCoordinatorDashboardDataAction,
  requireApprovedCoordinator,
} from '@/app/coordinator/coordinator-actions';
import type { CoordinatorSchoolReportData } from '@/app/coordinator/coordinator-report-types';
import { computeCoordinatorReportSealServer } from '@/lib/b2b/coordinator-report-seal-server';
import {
  averageIeltsForStudents,
  averageSatForStudents,
  buildCoordinatorSchoolReportAnalytics,
  loadReportAttemptRowsForStudents,
  loadStudentIdsByTeacher,
} from '@/lib/b2b/coordinator-school-report-analytics';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';

const DEFAULT_EMBLEM = 'Interscola Institutional';

export async function getCoordinatorSchoolReportDataAction(input?: {
  organizationId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: CoordinatorSchoolReportData;
}> {
  try {
    const gate = await requireApprovedCoordinator();
    if (!gate) {
      return {
        success: false,
        error: 'Onaylı koordinatör veya yönetici oturumu gerekir.',
      };
    }

    const dashboardResult = await getCoordinatorDashboardDataAction(
      input?.organizationId?.trim()
        ? { organizationId: input.organizationId.trim() }
        : undefined,
    );
    if (!dashboardResult.success || !dashboardResult.data) {
      return {
        success: false,
        error: dashboardResult.error ?? 'Kurum verisi yüklenemedi.',
      };
    }

    const dashboard = dashboardResult.data;
    const context = dashboard.context;
    const org = context.organization;
    const perf = context.orgPerformance;
    const license = dashboard.license;

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const studentUserIds = context.students.map((s) => s.userId);
    const teacherUserIds = context.teachers.map((t) => t.userId);

    const [analytics, attemptRows, studentsByTeacher] = await Promise.all([
      buildCoordinatorSchoolReportAnalytics(
        client,
        studentUserIds,
        studentUserIds.length,
      ),
      loadReportAttemptRowsForStudents(studentUserIds),
      loadStudentIdsByTeacher(client, teacherUserIds, studentUserIds),
    ]);

    const faculty = dashboard.teachersWithLoad.map((teacher) => {
      const cohort = studentsByTeacher.get(teacher.userId) ?? [];
      return {
        displayName: teacher.displayName,
        email: teacher.email,
        branchName: teacher.branchName,
        linkedStudentCount: teacher.linkedStudentCount,
        avgSatScore: averageSatForStudents(cohort, attemptRows),
        avgIeltsBand: averageIeltsForStudents(cohort, attemptRows),
      };
    });

    const issuedAtIso = new Date().toISOString();
    const verificationCode = computeCoordinatorReportSealServer(
      org.id,
      issuedAtIso,
    );

    const data: CoordinatorSchoolReportData = {
      organizationId: org.id,
      organizationName: org.name,
      emblemLabel: DEFAULT_EMBLEM,
      reportIssuedAtIso: issuedAtIso,
      coordinatorName: gate.fullName,
      verificationCode,
      licenseType: org.licenseType,
      joinCode: dashboard.joinCode,
      license: {
        studentQuota: license.studentQuota,
        studentsUsed: license.studentsActive,
        studentUsagePercent: license.usagePercent,
        teacherQuota: license.teacherQuota,
        teachersUsed: license.teachersUsed,
        teacherUsagePercent: license.teacherUsagePercent,
      },
      academic: {
        totalCompletedAttempts: perf.totalCompletedAttempts,
        avgSatScore: perf.avgSatScore,
        avgIeltsBand: perf.avgIeltsBand,
        caieSuccessPercent: analytics.caieSuccessPercent,
        completionRatePercent: analytics.completionRatePercent,
      },
      faculty,
      criticalWeaknesses: analytics.criticalWeaknesses,
      branchCount: context.branches.length,
      caieAo: analytics.caieAo,
    };

    return { success: true, data };
  } catch (error) {
    console.error(
      '[coordinator-report] getCoordinatorSchoolReportDataAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
