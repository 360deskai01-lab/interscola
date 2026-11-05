import type { AcademicTranscriptData } from '@/lib/student-transcript/types';

function stableTranscriptPayload(
  studentId: string,
  transcript: AcademicTranscriptData,
): string {
  return JSON.stringify({
    v: 1,
    network: 'INTERSCOLA',
    studentId,
    updatedAt: transcript.updatedAt ?? '',
    cumulative100: transcript.cumulative100,
    gpa4Scale: transcript.gpa4Scale,
    years: transcript.years,
  });
}

/** Kayıtlı transkript + öğrenci kimliğinden deterministik doğrulama kodu (SHA-256). */
export async function computeTranscriptVerificationCode(
  studentId: string,
  transcript: AcademicTranscriptData,
): Promise<string> {
  const canonical = stableTranscriptPayload(studentId, transcript);
  const bytes = new TextEncoder().encode(canonical);

  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return `INT-REC-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}`;
  }

  let hash = 0;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = (hash * 31 + canonical.charCodeAt(i)) >>> 0;
  }
  const fallback = hash.toString(16).toUpperCase().padStart(8, '0');
  return `INT-REC-${fallback}-LOCAL`;
}
