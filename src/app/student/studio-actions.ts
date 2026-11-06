'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import {
  decorateExamForSessionFormat,
  questionCountForSessionFormat,
  type ExamSessionFormatId,
} from '@/lib/exam/exam-session-formats';
import {
  MIN_LIBRARY_EXTRACTED_TEXT_CHARS,
  resolveExamPayloadForLibrary,
} from '@/lib/library-exam-generation';
import { parseAssessmentPayload } from '@/lib/assessment-payload';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';
import {
  STUDIO_MAX_MATERIAL_CHARS,
  STUDIO_MAX_PDF_BYTES,
  STUDIO_MAX_UPLOADS_PER_HOUR,
  STUDIO_MIN_MATERIAL_CHARS,
  parseStudioCurriculum,
  parseStudioScope,
} from '@/lib/student-studio/constants';
import type { CurriculumCode } from '@/types/exam';

export interface CreateCustomExamResult {
  success: boolean;
  error?: string;
  assignmentId?: string;
}

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

/** PDF'in ilk baytları `%PDF-` ile başlamalı (yalnızca uzantı/MIME'a güvenilmez). */
function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

async function extractPdfText(
  file: File,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (file.size > STUDIO_MAX_PDF_BYTES) {
    return {
      ok: false,
      error: `PDF en fazla ${Math.round(STUDIO_MAX_PDF_BYTES / (1024 * 1024))} MB olabilir.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) {
    return { ok: false, error: 'Yüklenen dosya geçerli bir PDF değil.' };
  }

  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return { ok: true, text: text.replace(/\s+/g, ' ').trim() };
  } catch (error) {
    console.error(
      '[student-studio] PDF metni çıkarılamadı:',
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      error:
        'PDF okunamadı. Şifreli veya bozuk bir dosya olabilir; metni yapıştırmayı dene.',
    };
  }
}

function deriveSubject(curriculum: CurriculumCode, material: string): string {
  const firstLine = material
    .split(/[.\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 8);
  const base = (firstLine ?? '').slice(0, 60);
  return base || (curriculum === 'SAT' ? 'Reading & Writing' : 'Custom Material');
}

/**
 * Öğrencinin ders notundan / PDF'inden kişisel sınav üretir.
 *
 * Akış: doğrula → metni çıkar → mevcut `runGenerateExam` çekirdeği (üzerinden
 * `resolveExamPayloadForLibrary`) → özel (is_public=false) kütüphane kaydı →
 * `assignments` kaydı. Dönen `assignmentId` ile istemci `/exam-session/[id]`'ye gider.
 */
export async function createCustomExamFromMaterialAction(
  formData: FormData,
): Promise<CreateCustomExamResult> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    const curriculum = parseStudioCurriculum(formData.get('curriculum'));
    if (!curriculum) {
      return { success: false, error: 'Geçerli bir hedef motor seçmelisin.' };
    }
    const scope = parseStudioScope(formData.get('scope'));
    if (!scope) {
      return { success: false, error: 'Geçerli bir kapsam seçmelisin.' };
    }

    const pastedRaw = formData.get('material_text');
    const pasted = typeof pastedRaw === 'string' ? pastedRaw.trim() : '';

    const fileEntry = formData.get('material_pdf');
    let pdfText = '';
    if (fileEntry instanceof File && fileEntry.size > 0) {
      const extracted = await extractPdfText(fileEntry);
      if (!extracted.ok) return { success: false, error: extracted.error };
      pdfText = extracted.text;
    }

    const combined = [pdfText, pasted].filter(Boolean).join('\n\n').trim();
    const minChars = Math.max(
      STUDIO_MIN_MATERIAL_CHARS,
      MIN_LIBRARY_EXTRACTED_TEXT_CHARS,
    );
    if (combined.length < minChars) {
      return {
        success: false,
        error:
          fileEntry instanceof File && fileEntry.size > 0 && !pasted
            ? 'PDF’den yeterli metin çıkarılamadı (taranmış görsel olabilir). Metni yapıştırmayı dene.'
            : `Kaliteli bir sınav için en az ${minChars} karakterlik metin gerekir.`,
      };
    }
    const material = combined.slice(0, STUDIO_MAX_MATERIAL_CHARS);

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    // Maliyet koruması: LLM çağrısından ÖNCE saatlik kota kontrolü.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await client
      .from('libraries')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', student.userId)
      .eq('origin_type', 'user_uploaded')
      .gte('created_at', since);

    if (countError) {
      console.error('[student-studio] Kota okunamadı:', countError.message);
      if (countError.code === '42703') {
        return {
          success: false,
          error:
            'AI Sınav Üretici için veritabanı güncellemesi bekleniyor. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Kota doğrulanamadı. Lütfen tekrar dene.' };
    }
    if ((count ?? 0) >= STUDIO_MAX_UPLOADS_PER_HOUR) {
      return {
        success: false,
        error: `Saatte en fazla ${STUDIO_MAX_UPLOADS_PER_HOUR} özel sınav üretebilirsin. Biraz sonra tekrar dene.`,
      };
    }

    const sessionFormat: ExamSessionFormatId =
      scope === 'quick' ? 'diagnostic_drill' : 'mini_mock';
    // Üretim çekirdeği, müfredat başına üst sınırı kendisi uygular
    // (`LIBRARY_EXAM_MODE`); burada yalnızca format hedefi iletilir.
    const subject = deriveSubject(curriculum, material);
    const generated = await resolveExamPayloadForLibrary(
      {
        title: subject,
        curriculum,
        subject,
        extracted_text: material,
        exam_payload: null,
      },
      questionCountForSessionFormat(sessionFormat, curriculum),
    );
    if (!generated.ok) {
      return { success: false, error: generated.error };
    }

    const decorated = decorateExamForSessionFormat(
      generated.exam,
      sessionFormat,
      curriculum,
    );
    let validated;
    try {
      validated = parseAssessmentPayload(decorated);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Üretilen sınav doğrulanamadı.',
      };
    }

    const { data: library, error: libraryError } = await client
      .from('libraries')
      .insert({
        title: `AI Stüdyo · ${subject}`.slice(0, 140),
        curriculum,
        subject,
        extracted_text: material,
        exam_payload: validated,
        is_public: false,
        teacher_id: null,
        created_by: student.userId,
        origin_type: 'user_uploaded',
        exam_format: 'drill',
      })
      .select('id')
      .single();

    if (libraryError || !library) {
      console.error(
        '[student-studio] Kütüphane kaydı oluşturulamadı:',
        libraryError?.message,
      );
      if (libraryError?.code === '42703') {
        return {
          success: false,
          error:
            'AI Sınav Üretici için veritabanı güncellemesi bekleniyor. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Özel sınav kaydedilemedi.' };
    }

    const libraryId = (library as { id: string }).id;

    const { data: assignment, error: assignmentError } = await client
      .from('assignments')
      .insert({
        library_id: libraryId,
        teacher_id: null,
        student_id: student.userId,
        status: 'in_progress',
        assignment_type: 'exam',
        exam_payload: validated,
      })
      .select('id')
      .single();

    if (assignmentError || !assignment) {
      console.error(
        '[student-studio] Atama oluşturulamadı:',
        assignmentError?.message,
      );
      // Yetim kütüphane satırı bırakma (kota sayacını da şişirmesin).
      const { error: cleanupError } = await client
        .from('libraries')
        .delete()
        .eq('id', libraryId)
        .eq('created_by', student.userId);
      if (cleanupError) {
        console.error(
          '[student-studio] Yetim kütüphane temizlenemedi:',
          cleanupError.message,
        );
      }
      return { success: false, error: 'Sınav oturumu başlatılamadı.' };
    }

    revalidatePath('/student/dashboard');
    return {
      success: true,
      assignmentId: (assignment as { id: string }).id,
    };
  } catch (error) {
    console.error(
      '[student-studio] createCustomExamFromMaterialAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Sınav üretilirken beklenmeyen bir hata oluştu.' };
  }
}
