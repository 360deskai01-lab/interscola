import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  getStudentProfileDbClient,
  loadStudentGoalsContext,
} from '@/lib/student-profile/load-context';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { StudentGoalsConsoleClient } from '@/components/student/StudentGoalsConsoleClient';

export const instant = false;

export default async function StudentGoalsPage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.role !== 'student' || current.profile.status !== 'approved') {
    redirect('/');
  }

  const client = await getStudentProfileDbClient();
  if (!client) {
    return (
      <div className="min-h-dvh bg-slate-950 p-8 text-center text-rose-200">
        Veritabanı bağlantısı kurulamadı.
      </div>
    );
  }

  const loaded = await loadStudentGoalsContext(client, current.user.id);
  if (!loaded.ok) {
    return (
      <div className="min-h-dvh bg-slate-950 p-8 text-center text-rose-200">
        {loaded.error}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <StudentGoalsConsoleClient initialContext={loaded.data} />
    </div>
  );
}
