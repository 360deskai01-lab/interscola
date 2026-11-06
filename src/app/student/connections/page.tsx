import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  getStudentProfileDbClient,
  loadStudentOrganization,
} from '@/lib/student-profile/load-context';
import { getStudentTeachersAction } from '@/app/student/actions';
import { getStudentAcademicProfileAction } from '@/app/student/profile-actions';
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

  const [teachersResult, client, profileResult] = await Promise.all([
    getStudentTeachersAction(),
    getStudentProfileDbClient(),
    getStudentAcademicProfileAction(),
  ]);

  const teachers = teachersResult.teachers ?? [];
  const organization = client
    ? await loadStudentOrganization(client, current.user.id)
    : null;

  if (!profileResult.success || !profileResult.data) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100">
        <NavbarServer />
        <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-rose-200">
          {profileResult.error ?? 'Bağlantılar merkezi yüklenemedi.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <StudentConnectionsClient
        teachers={teachers}
        organization={organization}
        observerToken={profileResult.data.observerToken}
      />
    </div>
  );
}
