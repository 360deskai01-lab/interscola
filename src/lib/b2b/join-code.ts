/** Karıştırılabilir 0/O ve 1/I hariç — 6 karakter. */
export const JOIN_CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const JOIN_CODE_LENGTH = 6;

export const JOIN_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/** Form alanı: harf, rakam, tire; otomatik büyük harf. */
export const JOIN_CODE_FIELD_MAX_LENGTH = 8;

export function formatJoinCodeFieldInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, JOIN_CODE_FIELD_MAX_LENGTH);
}

/** Sunucu eşleştirmesi: tire ve geçersiz karakterler elenir → 6 karakter. */
export function normalizeJoinCodeInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, '');
}

export function generateRandomJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    const index = bytes[i]! % JOIN_CODE_CHARSET.length;
    out += JOIN_CODE_CHARSET.charAt(index);
  }
  return out;
}

/** Görüntü: `ABC123` → `ABC-123` */
export function formatJoinCodeDisplay(code: string): string {
  const normalized = normalizeJoinCodeInput(code);
  if (normalized.length !== JOIN_CODE_LENGTH) {
    return normalized || '—';
  }
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}
