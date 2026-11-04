import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { resolveDiagnosticLibrary } from '@/lib/test-et/resolve-diagnostic-library';
import { CAIE_ANDRADE_DIAGNOSTIC_EXAM } from '@/lib/test-et/caie-andrade-seed';
import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

async function getLibrariesReadClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

/** Misafir teşhis: oturum gerektirmeden doğrulanmış / statik payload. */
export async function loadGuestDiagnosticExam(
  curriculum: CurriculumCode,
): Promise<AssessmentPayload | null> {
  const client = await getLibrariesReadClient();
  if (!client) {
    return curriculum === 'CAIE' ? CAIE_ANDRADE_DIAGNOSTIC_EXAM : null;
  }

  try {
    const resolved = await resolveDiagnosticLibrary(client, curriculum);
    return resolved.exam;
  } catch {
    return curriculum === 'CAIE' ? CAIE_ANDRADE_DIAGNOSTIC_EXAM : null;
  }
}
