'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';
import {
  normalizeActivityPassportInput,
  parseActivityPassport,
} from '@/lib/student-portfolio/parse-portfolio';
import type { ActivityPassportData } from '@/lib/student-portfolio/types';

const STUDENT_DASHBOARD_PATH = '/student/dashboard';

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

export async function getStudentActivitiesAction(): Promise<{
  success: boolean;
  error?: string;
  data?: ActivityPassportData;
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
      .select('activity_passport')
      .eq('id', student.userId)
      .maybeSingle();

    if (error) {
      console.error('[student-portfolio] okuma:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Aktivite pasaportu alanı henüz veritabanında tanımlı değil. Migration uygulanmalı.',
        };
      }
      return { success: false, error: 'Aktivite pasaportu yüklenemedi.' };
    }

    return {
      success: true,
      data: parseActivityPassport(data?.activity_passport),
    };
  } catch (error) {
    console.error(
      '[student-portfolio] getStudentActivitiesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Aktivite pasaportu yüklenemedi.' };
  }
}

export async function saveStudentActivitiesAction(
  activities: ActivityPassportData,
): Promise<{ success: boolean; error?: string; data?: ActivityPassportData }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const normalized = normalizeActivityPassportInput(activities);
    if (normalized.error || !normalized.data) {
      return {
        success: false,
        error: normalized.error ?? 'Geçersiz aktivite verisi.',
      };
    }

    const payload: ActivityPassportData = {
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
        activity_passport: payload,
        updated_at: payload.updatedAt,
      })
      .eq('id', student.userId);

    if (error) {
      console.error('[student-portfolio] kayıt:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Aktivite pasaportu alanı henüz veritabanında tanımlı değil. Migration uygulanmalı.',
        };
      }
      return { success: false, error: 'Aktivite pasaportu kaydedilemedi.' };
    }

    revalidatePath(STUDENT_DASHBOARD_PATH);
    return { success: true, data: payload };
  } catch (error) {
    console.error(
      '[student-portfolio] saveStudentActivitiesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
