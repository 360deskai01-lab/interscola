/** Üniversite adından URL slug üretir (Türkçe karakterler sadeleştirilir). */
export function slugifyUniversityName(name: string): string {
  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (normalized || 'university').slice(0, 96);
}

export function ensureUniqueSlug(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}
