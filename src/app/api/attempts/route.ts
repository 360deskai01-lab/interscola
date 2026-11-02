import { NextResponse, type NextRequest } from 'next/server';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

/** Geçmiş listesinde gösterilecek varsayılan kayıt sayısı. */
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

interface AttemptRow {
  id: string;
  curriculum: string;
  subject: string;
  exam_title: string | null;
  engine_type: string;
  raw_score: number;
  max_score: number;
  percentage: number;
  scaled_result: string;
  metric_breakdown: Record<string, number | string> | null;
  student_answers: Record<string, string> | null;
  evaluations: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Geçmiş denemeleri döner.
 *
 * Service role anahtarı yalnızca sunucuda kalır; bu yüzden okuma işlemi de
 * tarayıcıdan değil bu endpoint üzerinden yapılır.
 *
 * İZOLASYON: Oturum açmış kullanıcı yalnızca kendi denemelerini görür.
 * Oturum yoksa anonim akış bozulmasın diye genel son denemeler döner.
 *
 * Supabase yapılandırılmamışsa boş liste döner (hata değil): geçmiş özelliği
 * ikincil bir kolaylıktır, yokluğu ana akışı bozmamalıdır.
 */
export async function GET(request: NextRequest) {
  const rawLimit = Number(
    request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT,
  );
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)))
    : DEFAULT_LIMIT;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: true, attempts: [] });
  }

  const sessionUser = await getSessionUser();

  const selectColumns =
    'id, curriculum, subject, exam_title, engine_type, raw_score, max_score, percentage, scaled_result, metric_breakdown, student_answers, evaluations, created_at';

  try {
    const filtered = async (withStudentFilter: boolean) => {
      let query = supabase
        .from(ATTEMPTS_TABLE)
        .select(selectColumns)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (withStudentFilter && sessionUser) {
        query = query.eq('student_id', sessionUser.id);
      }

      return await query;
    };

    const isLoggedIn = sessionUser !== null;
    let { data, error } = await filtered(isLoggedIn);

    /*
     * Şema henüz `student_id` içermiyorsa filtresiz sorguya düşülür.
     * Böylece kolon eklenmeden önce de geçmiş listesi çalışmaya devam eder.
     */
    if (error && isLoggedIn && isMissingStudentColumnError(error)) {
      console.warn(
        '[attempts] student_id kolonu yok; filtre olmadan okunuyor. ' +
          'İzolasyon için ALTER TABLE çalıştırılmalı.',
      );
      ({ data, error } = await filtered(false));
    }

    if (error) {
      console.error('[attempts] Geçmiş okunamadı:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
      });
      return NextResponse.json(
        { success: false, error: 'Geçmiş denemeler okunamadı.', attempts: [] },
        { status: 500 },
      );
    }

    const attempts = (data ?? []) as AttemptRow[];
    return NextResponse.json({ success: true, attempts });
  } catch (error) {
    console.error(
      '[attempts] Beklenmeyen hata:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { success: false, error: 'Geçmiş denemeler okunamadı.', attempts: [] },
      { status: 500 },
    );
  }
}

/** `student_id` kolonunun bulunmadığını gösteren PostgREST/Postgres hataları. */
function isMissingStudentColumnError(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const haystack =
    `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    haystack.includes('student_id') ||
    haystack.includes('schema cache')
  );
}
