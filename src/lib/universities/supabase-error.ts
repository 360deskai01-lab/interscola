/** PostgREST hata nesneleri doğrudan loglanınca `{}` görünebilir; mesajı çıkar. */
export function formatSupabaseError(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [
      record.message,
      record.details,
      record.hint,
      record.code ? `code=${record.code}` : null,
    ].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' | ');
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
