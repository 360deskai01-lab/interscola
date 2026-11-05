'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentProfile } from '@/lib/auth';
import { mergeGuestLeadIntoTargetScores } from '@/lib/guest-lead/merge-target-scores';
import type { GuestLeadClaimPayload } from '@/lib/guest-lead/types';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';

const STUDENT_DASHBOARD_PATH = '/student/dashboard';

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

function hasClaimPayload(data: GuestLeadClaimPayload): boolean {
  return Boolean(data.scholarship || data.budget);
}

export async function claimGuestSimulationsAction(
  data: GuestLeadClaimPayload,
): Promise<{ success: boolean; error?: string; claimed?: ('scholarship' | 'budget')[] }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Misafir verilerini aktarmak için onaylı öğrenci oturumu gerekir.',
      };
    }

    if (!hasClaimPayload(data)) {
      return { success: false, error: 'Aktarılacak misafir simülasyon verisi yok.' };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: profileRow, error: readError } = await client
      .from('profiles')
      .select('target_scores')
      .eq('id', student.userId)
      .maybeSingle();

    if (readError) {
      console.error('[claim-guest] target_scores okunamadı:', readError.message);
      if (readError.code === '42703') {
        return {
          success: false,
          error:
            'Profil hedef alanları henüz veritabanında tanımlı değil. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Profil okunamadı.' };
    }

    const merged = mergeGuestLeadIntoTargetScores(
      profileRow?.target_scores ?? {},
      {
        scholarship: data.scholarship,
        budget: data.budget,
      },
    );

    const { error: updateError } = await client
      .from('profiles')
      .update({
        target_scores: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', student.userId);

    if (updateError) {
      console.error('[claim-guest] target_scores güncellenemedi:', updateError.message);
      return { success: false, error: 'Misafir simülasyon verisi kaydedilemedi.' };
    }

    const claimed: ('scholarship' | 'budget')[] = [];
    if (data.scholarship) claimed.push('scholarship');
    if (data.budget) claimed.push('budget');

    revalidatePath(STUDENT_DASHBOARD_PATH);
    revalidatePath('/student/dashboard', 'layout');

    return { success: true, claimed };
  } catch (error) {
    console.error(
      '[claim-guest] claimGuestSimulationsAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
