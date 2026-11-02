'use server';

import { getSessionUser } from '@/lib/auth';
import { generateCareerGuidanceReport } from '@/lib/assessment/ai-report';
import { extractTopStrengthTraits } from '@/lib/student-dashboard/parse-score-matrix';
import type {
  AssessmentAnswers,
  AssessmentKind,
  AssessmentScoreMatrix,
} from '@/types/assessment';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

function buildLiveInsertPayload(
  payload: {
    kind: AssessmentKind;
    guestSessionId: string | null;
    answers: AssessmentAnswers;
    scores: AssessmentScoreMatrix;
  },
  userId: string | null,
  guestId: string | null,
) {
  return {
    assessment_type: payload.kind,
    guest_session_id: userId ? null : guestId,
    user_id: userId,
    answers: payload.answers,
    scores: payload.scores,
    top_traits: extractTopStrengthTraits(payload.scores),
    ai_interpretation: null as string | null,
  };
}

function buildLegacyInsertPayload(
  payload: {
    kind: AssessmentKind;
    guestSessionId: string | null;
    answers: AssessmentAnswers;
    scores: AssessmentScoreMatrix;
  },
  userId: string | null,
  guestId: string | null,
) {
  return {
    assessment_kind: payload.kind,
    guest_session_id: userId ? null : guestId,
    user_id: userId,
    answers: payload.answers,
    score_matrix: payload.scores,
    holland_code: payload.scores.hollandCode,
  };
}

export async function saveCareerAssessmentAction(payload: {
  kind: AssessmentKind;
  guestSessionId: string | null;
  answers: AssessmentAnswers;
  scores: AssessmentScoreMatrix;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) {
    return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
  }

  const sessionUser = await getSessionUser();
  const guestId = payload.guestSessionId?.trim() || null;

  if (!sessionUser && !guestId) {
    return {
      success: false,
      error: 'Misafir oturumu veya üyelik gerekli.',
    };
  }

  const userId = sessionUser?.id ?? null;

  let { data, error } = await client
    .from('career_assessments')
    .insert(buildLiveInsertPayload(payload, userId, guestId))
    .select('id')
    .single();

  if (error?.code === '42703') {
    ({ data, error } = await client
      .from('career_assessments')
      .insert(buildLegacyInsertPayload(payload, userId, guestId))
      .select('id')
      .single());
  }

  if (error) {
    if (error.code === '42P01') {
      return {
        success: false,
        error: 'career_assessments tablosu henüz yok. Migration uygulayın.',
      };
    }
    console.error('[career-compass] Kayıt hatası:', error.message);
    return { success: false, error: 'Sonuç kaydedilemedi.' };
  }

  const row = data as { id: string };
  return { success: true, id: row.id };
}

export async function generateDeepCareerReportAction(
  scores: AssessmentScoreMatrix,
  assessmentId?: string,
): Promise<{ success: boolean; error?: string; report?: string }> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return {
      success: false,
      error: 'Derin AI raporu yalnızca kayıtlı öğrenciler içindir.',
    };
  }

  const result = await generateCareerGuidanceReport(scores);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (assessmentId) {
    const client = getSupabaseAdmin(PROFILES_SCHEMA);
    if (client) {
      const liveUpdate = await client
        .from('career_assessments')
        .update({ ai_interpretation: result.report })
        .eq('id', assessmentId)
        .eq('user_id', sessionUser.id);

      if (liveUpdate.error?.code === '42703') {
        await client
          .from('career_assessments')
          .update({ ai_report: result.report })
          .eq('id', assessmentId)
          .eq('user_id', sessionUser.id);
      }
    }
  }

  return { success: true, report: result.report };
}
