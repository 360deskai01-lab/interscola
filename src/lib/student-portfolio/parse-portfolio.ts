import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_GRADE_LEVELS,
  createEmptyActivityPassport,
  IMPACT_DESCRIPTION_MAX_LENGTH,
  type ActivityCategory,
  type ActivityGradeLevel,
  type ActivityItem,
  type ActivityPassportData,
} from '@/lib/student-portfolio/types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCategory(raw: unknown): ActivityCategory | null {
  if (typeof raw !== 'string') return null;
  return ACTIVITY_CATEGORIES.includes(raw as ActivityCategory)
    ? (raw as ActivityCategory)
    : null;
}

function parseGrades(raw: unknown): ActivityGradeLevel[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<ActivityGradeLevel>();
  for (const entry of raw) {
    const text = String(entry);
    if (ACTIVITY_GRADE_LEVELS.includes(text as ActivityGradeLevel)) {
      set.add(text as ActivityGradeLevel);
    }
  }
  return [...set].sort();
}

function parseOptionalUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseActivityItem(raw: unknown): ActivityItem | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const category = parseCategory(raw.category);
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const organization =
    typeof raw.organization === 'string' ? raw.organization.trim() : '';
  const role = typeof raw.role === 'string' ? raw.role.trim() : '';
  const impactDescription =
    typeof raw.impactDescription === 'string'
      ? raw.impactDescription.trim()
      : '';

  const hoursPerWeek =
    typeof raw.hoursPerWeek === 'number'
      ? raw.hoursPerWeek
      : Number.parseFloat(String(raw.hoursPerWeek ?? ''));
  const weeksPerYear =
    typeof raw.weeksPerYear === 'number'
      ? raw.weeksPerYear
      : Number.parseInt(String(raw.weeksPerYear ?? ''), 10);

  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim()
      ? raw.createdAt
      : new Date().toISOString();

  if (!UUID_PATTERN.test(id)) return null;
  if (!category || !title || !organization || !role) return null;
  if (!impactDescription || impactDescription.length > IMPACT_DESCRIPTION_MAX_LENGTH) {
    return null;
  }
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0 || hoursPerWeek > 80) {
    return null;
  }
  if (!Number.isFinite(weeksPerYear) || weeksPerYear <= 0 || weeksPerYear > 52) {
    return null;
  }

  const grades = parseGrades(raw.grades);
  if (grades.length === 0) return null;

  const certificateUrl = parseOptionalUrl(raw.certificateUrl);

  return {
    id,
    category,
    title,
    organization,
    role,
    grades,
    hoursPerWeek,
    weeksPerYear,
    impactDescription,
    certificateUrl,
    createdAt,
  };
}

export function parseActivityPassport(raw: unknown): ActivityPassportData {
  if (!isRecord(raw)) return createEmptyActivityPassport();

  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) {
    return createEmptyActivityPassport();
  }

  const items = itemsRaw
    .map(parseActivityItem)
    .filter((item): item is ActivityItem => item !== null);

  return {
    items,
    updatedAt:
      typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

export function normalizeActivityPassportInput(
  input: ActivityPassportData,
): { data?: ActivityPassportData; error?: string } {
  if (!input || !Array.isArray(input.items)) {
    return { error: 'Aktivite verisi geçersiz.' };
  }

  const items: ActivityItem[] = [];
  for (const entry of input.items) {
    const parsed = parseActivityItem(entry);
    if (!parsed) {
      return {
        error:
          'Bir veya daha fazla aktivite satırı geçersiz. Başlık, kurum, rol, sınıf, saat ve etki alanlarını kontrol edin.',
      };
    }
    items.push(parsed);
  }

  return {
    data: {
      items,
      updatedAt: input.updatedAt,
    },
  };
}
