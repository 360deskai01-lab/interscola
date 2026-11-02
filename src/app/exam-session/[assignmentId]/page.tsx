import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  completeAssignmentExamFormAction,
  getStudentAssignmentExamAction,
} from '@/app/student/actions';
import { startSelfPacedExamFormAction } from '@/app/student/public-library-actions';
import { StudentAssignmentExamClient } from '@/components/student/StudentAssignmentExamClient';

export const instant = false;

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

/**
 * Öğrenci atama sınavı oturumu — ExamRunner akışının resmi giriş rotası.
 */
export default async function ExamSessionPage({
  params,
}: PageProps): Promise<ReactNode> {
  await connection();

  const { assignmentId } = await params;

  const current = await getCurrentProfile();
  if (!current) {
    redirect('/auth/login');
  }

  if (
    current.profile.status !== 'approved' ||
    current.profile.role !== 'student'
  ) {
    redirect('/');
  }

  const result = await getStudentAssignmentExamAction(assignmentId);

  if (!result.success || !result.context) {
    redirect(`/student/dashboard?examError=${encodeURIComponent(result.error ?? 'Sınav açılamadı')}`);
  }

  const { exam, materialTitle, isSelfPractice, libraryId } = result.context;

  return (
    <StudentAssignmentExamClient
      assignmentId={assignmentId}
      materialTitle={materialTitle}
      exam={exam}
      sessionLabel={
        isSelfPractice ? 'Açık Havuz Pratiği' : 'Eğitmen Sınavı'
      }
      reviewHref={`/exam-session/${assignmentId}/review`}
      isSelfPractice={isSelfPractice}
      libraryId={libraryId}
      onStartSelfPacedExam={
        isSelfPractice ? startSelfPacedExamFormAction : undefined
      }
      onCompleteAssignment={completeAssignmentExamFormAction}
    />
  );
}
