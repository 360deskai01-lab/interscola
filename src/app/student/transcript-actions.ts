'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';
import type { AcademicTranscriptData } from '@/lib/student-transcript/types';
import {
  normalizeTranscriptInput,
  parseAcademicTranscript,
} from '@/lib/student-transcript/parse-transcript';

const STUDENT_DASHBOARD_PATH = '/student/dashboard';

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

export async function getStudentTranscriptAction(): Promise<{
  success: boolean;
  error?: string;
  data?: AcademicTranscriptData;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('profiles')
      .select('academic_transcript')
      .eq('id', student.userId)
      .maybeSingle();

    if (error) {
      console.error('[student-transcript] okuma:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Transkript alanı henüz veritabanında tanımlı değil. Migration uygulanmalı.',
        };
      }
      return { success: false, error: 'Transkript yüklenemedi.' };
    }

    return {
      success: true,
      data: parseAcademicTranscript(data?.academic_transcript),
    };
  } catch (error) {
    console.error(
      '[student-transcript] getStudentTranscriptAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Transkript yüklenemedi.' };
  }
}

export async function saveStudentTranscriptAction(
  transcript: AcademicTranscriptData,
): Promise<{ success: boolean; error?: string; data?: AcademicTranscriptData }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const normalized = normalizeTranscriptInput(transcript);
    if (normalized.error || !normalized.data) {
      return { success: false, error: normalized.error ?? 'Geçersiz transkript.' };
    }

    const payload = {
      ...normalized.data,
      updatedAt: new Date().toISOString(),
    };

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { error } = await client
      .from('profiles')
      .update({
        academic_transcript: payload,
        updated_at: payload.updatedAt,
      })
      .eq('id', student.userId);

    if (error) {
      console.error('[student-transcript] kayıt:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Transkript alanı henüz veritabanında tanımlı değil. Migration uygulanmalı.',
        };
      }
      return { success: false, error: 'Transkript kaydedilemedi.' };
    }

    revalidatePath(STUDENT_DASHBOARD_PATH);
    return { success: true, data: payload };
  } catch (error) {
    console.error(
      '[student-transcript] saveStudentTranscriptAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
