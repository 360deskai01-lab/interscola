const CAIE_GRADE_PATTERN = /Grade\s+(A\*|A|B|C|D|E|U)/i;

/** `scaled_result` → `A*`, `A`, … `U` */
export function parseCaieGradeFromScaledResult(
  scaled: unknown,
): string | null {
  if (typeof scaled !== 'string' || !scaled.trim()) {
    return null;
  }
  const matched = scaled.trim().match(CAIE_GRADE_PATTERN);
  if (!matched?.[1]) {
    return null;
  }
  const token = matched[1].toUpperCase();
  return token === 'A*' ? 'A*' : token;
}

export function formatCaieGradeLabel(grade: string): string {
  return `Grade ${grade}`;
}

/** Faz 7.1: tek ders CAIE notu — A* / A baraj üstü kabul edilir. */
export function caieGradeMeetsALevelThreshold(grade: string): boolean {
  return grade === 'A*' || grade === 'A';
}

export function resolveUniversityAlevelRequirement(university: {
  min_alevel: string | null;
  min_gpa: string | null;
}): string | null {
  const alevel = university.min_alevel?.trim();
  if (alevel) return alevel;
  const gpa = university.min_gpa?.trim();
  return gpa || null;
}
