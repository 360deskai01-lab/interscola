import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  getStudentProfileDbClient,
  loadStudentOrganization,
} from '@/lib/student-profile/load-context';
import { getStudentTeachersAction } from '@/app/student/actions';
import { listStudentObserverTokensAction } from '@/app/student/observer-actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { StudentConnectionsClient } from '@/components/student/StudentConnectionsClient';

export const instant = false;

export default async function StudentConnectionsPage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.role !== 'student' || current.profile.status !== 'approved') {
    redirect('/');
  }

  const [teachersResult, client, observerTokensResult] = await Promise.all([
    getStudentTeachersAction(),
    getStudentProfileDbClient(),
    listStudentObserverTokensAction(),
  ]);

  const teachers = teachersResult.teachers ?? [];
  const organization = client
    ? await loadStudentOrganization(client, current.user.id)
    : null;
  const observerTokens =
    observerTokensResult.success && observerTokensResult.tokens
      ? observerTokensResult.tokens
      : [];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <StudentConnectionsClient
        teachers={teachers}
        organization={organization}
        observerTokens={observerTokens}
      />
    </div>
  );
}
