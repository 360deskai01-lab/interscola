import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { StudentStudioClient } from '@/components/student/StudentStudioClient';

export const instant = false;
/** Server Action (LLM üretimi) bu rotanın süre sınırını kullanır. */
export const maxDuration = 60;

export default async function StudentStudioPage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) redirect('/auth/login');
  if (current.profile.role !== 'student' || current.profile.status !== 'approved') {
    redirect('/');
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <StudentStudioClient />
    </div>
  );
}
