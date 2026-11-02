import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  completeAssignmentExamFormAction,
  getStudentAssignmentExamAction,
} from '@/app/student/actions';
import { StudentAssignmentExamClient } from '@/components/student/StudentAssignmentExamClient';

export const instant = false;

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function StudentAssignmentExamPage({
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
    return (
      <div className="min-h-dvh bg-slate-950 px-5 py-16 text-slate-100">
        <div className="mx-auto max-w-md rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-rose-300" />
          <p className="mt-3 text-sm text-rose-100">
            {result.error ?? 'Sınav yüklenemedi.'}
          </p>
          <Link
            href="/student/dashboard"
            className="mt-6 inline-block rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white"
          >
            Öğrenci paneline dön
          </Link>
        </div>
      </div>
    );
  }

  const { exam, materialTitle } = result.context;

  return (
    <StudentAssignmentExamClient
      assignmentId={assignmentId}
      materialTitle={materialTitle}
      exam={exam}
      onCompleteAssignment={completeAssignmentExamFormAction}
    />
  );
}
