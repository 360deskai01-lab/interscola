import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { getStudentAcademicProfileAction } from '@/app/student/profile-actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { StudentProfileClient } from '@/components/student/StudentProfileClient';

export const instant = false;

export default async function StudentProfilePage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.role !== 'student' || current.profile.status !== 'approved') {
    redirect('/');
  }

  const profileResult = await getStudentAcademicProfileAction();

  if (!profileResult.success || !profileResult.data) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100">
        <NavbarServer />
        <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-rose-200">
          {profileResult.error ?? 'Profil yüklenemedi.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <StudentProfileClient initial={profileResult.data} />
    </div>
  );
}
