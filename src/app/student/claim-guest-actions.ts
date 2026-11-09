'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentProfile } from '@/lib/auth';
import { mergeGuestDiagnosticIntoTargetScores } from '@/lib/guest-lead/merge-diagnostic-baseline';
import { mergeGuestLeadIntoTargetScores } from '@/lib/guest-lead/merge-target-scores';
import type { GuestLeadClaimPayload } from '@/lib/guest-lead/types';
import {
  ATTEMPTS_TABLE,
  getSupabaseAdmin,
} from '@/lib/supabase';
import type { GuestDiagnosticClaimPayload } from '@/lib/test-et/guest-diagnostic-claim';
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

function isGuestDiagnosticClaimPayload(
  value: unknown,
): value is GuestDiagnosticClaimPayload {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as GuestDiagnosticClaimPayload;
  return (
    typeof row.examTitle === 'string' &&
    typeof row.curriculum === 'string' &&
    typeof row.engineType === 'string' &&
    typeof row.subject === 'string' &&
    Number.isFinite(row.rawScore) &&
    Number.isFinite(row.maxScore) &&
    Number.isFinite(row.percentage) &&
    typeof row.scaledResult === 'string' &&
    typeof row.completedAt === 'string' &&
    isRecord(row.studentAnswers)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export async function claimGuestDiagnosticExamAction(
  examData: GuestDiagnosticClaimPayload,
): Promise<{ success: boolean; error?: string; attemptId?: string }> {
  try {
    if (!isGuestDiagnosticClaimPayload(examData)) {
      return { success: false, error: 'Misafir teşhis verisi geçersiz.' };
    }

    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error:
          'Teşhis sonucunu aktarmak için onaylı öğrenci oturumu gerekir.',
      };
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return { success: false, error: 'Deneme kaydı sunucusu yapılandırılmadı.' };
    }

    const profileClient = await getStudentProfileDbClient();
    if (!profileClient) {
      return { success: false, error: 'Profil veritabanı bağlantısı kurulamadı.' };
    }

    const attemptRow: Record<string, unknown> = {
      curriculum: examData.curriculum,
      subject: examData.subject,
      exam_title: examData.examTitle,
      engine_type: examData.engineType,
      raw_score: examData.rawScore,
      max_score: examData.maxScore,
      percentage: examData.percentage,
      scaled_result: examData.scaledResult,
      metric_breakdown: examData.metricBreakdown,
      student_answers: examData.studentAnswers,
      evaluations: {
        feedback: examData.summary,
        remedialTopics: [],
        metricBreakdown: examData.metricBreakdown,
        is_timed_out: examData.is_timed_out ?? false,
        guestDiagnosticClaim: {
          slug: examData.slug,
          completedAt: examData.completedAt,
        },
      },
      student_id: student.userId,
      origin_type: 'diagnostic_claim',
    };

    const { data: inserted, error: insertError } = await supabase
      .from(ATTEMPTS_TABLE)
      .insert(attemptRow)
      .select('id')
      .single();

    if (insertError) {
      console.error('[claim-guest] assessment_attempts insert:', insertError.message);
      const withoutOrigin = { ...attemptRow };
      delete withoutOrigin.origin_type;
      const { data: retry, error: retryError } = await supabase
        .from(ATTEMPTS_TABLE)
        .insert(withoutOrigin)
        .select('id')
        .single();
      if (retryError) {
        return {
          success: false,
          error: 'Teşhis denemesi veritabanına yazılamadı.',
        };
      }
      const attemptId =
        retry && typeof retry === 'object' && 'id' in retry
          ? String((retry as { id: unknown }).id)
          : undefined;
      await syncGuestDiagnosticBaseline(profileClient, student.userId, examData);
      revalidatePath(STUDENT_DASHBOARD_PATH);
      revalidatePath('/student/dashboard', 'layout');
      return { success: true, attemptId };
    }

    const attemptId =
      inserted && typeof inserted === 'object' && 'id' in inserted
        ? String((inserted as { id: unknown }).id)
        : undefined;

    await syncGuestDiagnosticBaseline(profileClient, student.userId, examData);

    revalidatePath(STUDENT_DASHBOARD_PATH);
    revalidatePath('/student/dashboard', 'layout');

    return { success: true, attemptId };
  } catch (error) {
    console.error(
      '[claim-guest] claimGuestDiagnosticExamAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

async function syncGuestDiagnosticBaseline(
  profileClient: Awaited<ReturnType<typeof getStudentProfileDbClient>>,
  userId: string,
  examData: GuestDiagnosticClaimPayload,
): Promise<void> {
  if (!profileClient) return;

  const { data: profileRow, error: readError } = await profileClient
    .from('profiles')
    .select('target_scores')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[claim-guest] baseline okunamadı:', readError.message);
    return;
  }

  const merged = mergeGuestDiagnosticIntoTargetScores(
    profileRow?.target_scores ?? {},
    examData,
  );

  const { error: updateError } = await profileClient
    .from('profiles')
    .update({
      target_scores: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[claim-guest] baseline güncellenemedi:', updateError.message);
  }
}
