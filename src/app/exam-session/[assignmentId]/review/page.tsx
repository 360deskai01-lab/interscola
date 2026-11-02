import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { getStudentAssignmentReviewAction } from '@/app/student/actions';
import { startSelfPacedExamFormAction } from '@/app/student/public-library-actions';
import { AssignmentExamReviewClient } from '@/components/student/AssignmentExamReviewClient';

export const instant = false;

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function ExamSessionReviewPage({
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

  const result = await getStudentAssignmentReviewAction(assignmentId);

  if (!result.success || !result.context) {
    redirect('/student/dashboard');
  }

  const {
    exam,
    evaluation,
    studentAnswers,
    materialTitle,
    isSelfPractice,
    libraryId,
  } = result.context;

  return (
    <AssignmentExamReviewClient
      materialTitle={materialTitle}
      exam={exam}
      evaluation={evaluation}
      studentAnswers={studentAnswers}
      isSelfPractice={isSelfPractice}
      libraryId={libraryId}
      onStartSelfPacedExam={
        isSelfPractice ? startSelfPacedExamFormAction : undefined
      }
    />
  );
}
