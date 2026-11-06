import { formatSupabaseError } from '@/lib/universities/supabase-error';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  ExamTestCenterSummary,
  OfficialExamScheduleSummary,
} from '@/types/exam-radar';

const SCHEDULE_SELECT =
  'id, exam_name, exam_type, exam_date, registration_open_date, registration_close_date, is_active';

const CENTER_SELECT =
  'id, exam_schedule_id, city, center_name, address, capacity_status, is_authorized';

function isMissingTableOrSchemaCacheError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = error.code;
  const msg = error.message?.toLowerCase() ?? '';
  return (
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function todayUtcDateString(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calendarDaysUntil(examDateIso: string): number {
  const [y, mo, da] = examDateIso.split('-').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    return 0;
  }
  const exam = Date.UTC(y, mo - 1, da);
  const today = new Date();
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const diffMs = exam - start;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function mapScheduleRow(row: Record<string, unknown>): OfficialExamScheduleSummary {
  const examDate =
    typeof row.exam_date === 'string'
      ? row.exam_date.slice(0, 10)
      : todayUtcDateString();
  const examName =
    typeof row.exam_name === 'string' && row.exam_name.trim()
      ? row.exam_name.trim()
      : 'Resmi sınav';
  return {
    id: typeof row.id === 'string' ? row.id : '',
    examName,
    examType:
      typeof row.exam_type === 'string' && row.exam_type.trim()
        ? row.exam_type.trim()
        : null,
    examDate,
    registrationOpenDate:
      typeof row.registration_open_date === 'string' &&
      row.registration_open_date.trim()
        ? row.registration_open_date.trim().slice(0, 10)
        : null,
    registrationCloseDate:
      typeof row.registration_close_date === 'string' &&
      row.registration_close_date.trim()
        ? row.registration_close_date.trim().slice(0, 10)
        : null,
    daysRemaining: calendarDaysUntil(examDate),
  };
}

function mapCenterRow(row: Record<string, unknown>): ExamTestCenterSummary {
  const cap = row.capacity_status;
  const capacityStatus =
    cap === 'limited' ? 'limited' : 'available';
  return {
    id: typeof row.id === 'string' ? row.id : '',
    city: typeof row.city === 'string' ? row.city.trim() : '',
    centerName:
      typeof row.center_name === 'string' && row.center_name.trim()
        ? row.center_name.trim()
        : 'Merkez',
    address:
      typeof row.address === 'string' && row.address.trim()
        ? row.address.trim()
        : null,
    capacityStatus,
  };
}

async function getRadarDbClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

/**
 * `exam_date >= bugün`, aktif sınavlar arasında en yakın tarihli oturum.
 */
export async function fetchNearestOfficialExamSchedule(): Promise<OfficialExamScheduleSummary | null> {
  const client = await getRadarDbClient();
  if (!client) return null;

  const today = todayUtcDateString();

  const { data, error } = await client
    .from('official_exam_schedules')
    .select(SCHEDULE_SELECT)
    .eq('is_active', true)
    .gte('exam_date', today)
    .order('exam_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaCacheError(error)) {
      return null;
    }
    console.error(
      '[exam-radar] official_exam_schedules okunamadı:',
      formatSupabaseError(error),
    );
    return null;
  }

  if (!data) return null;
  return mapScheduleRow(data as Record<string, unknown>);
}

function normalizeCity(city: string | null | undefined): string | null {
  const t = city?.trim();
  return t ? t : null;
}

/**
 * Önce `userCity` ile eşleşen şehirler, sonra diğerleri (aynı sınav oturumu).
 */
export async function fetchExamTestCentersForSchedule(
  scheduleId: string,
  userCity?: string | null,
): Promise<ExamTestCenterSummary[]> {
  const normalizedId = scheduleId.trim();
  if (!normalizedId) return [];

  const client = await getRadarDbClient();
  if (!client) return [];

  const { data, error } = await client
    .from('exam_test_centers')
    .select(CENTER_SELECT)
    .eq('exam_schedule_id', normalizedId)
    .eq('is_authorized', true)
    .order('city', { ascending: true })
    .order('center_name', { ascending: true });

  if (error) {
    if (isMissingTableOrSchemaCacheError(error)) {
      return [];
    }
    console.error(
      '[exam-radar] exam_test_centers okunamadı:',
      formatSupabaseError(error),
      { scheduleId: normalizedId },
    );
    return [];
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapCenterRow);
  const cityFilter = normalizeCity(userCity);
  if (!cityFilter) {
    return rows;
  }

  const cityLc = cityFilter.toLowerCase();
  const inCity = rows.filter((r) => r.city.toLowerCase() === cityLc);
  const rest = rows.filter((r) => r.city.toLowerCase() !== cityLc);
  return [...inCity, ...rest];
}
