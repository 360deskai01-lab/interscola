import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';
import { COORDINATOR_ELIGIBLE_ORG_ROLES } from '@/lib/b2b/coordinator-types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

/**
 * Tarayıcının oturum durumunu öğrendiği uç nokta.
 * Oturum yoksa `user: null` döner (hata değil).
 * `role` alanı, arayüzde yönetim paneli butonunu göstermek için kullanılır.
 */
export async function GET() {
  const current = await getCurrentProfile();

  if (!current) {
    const user = await getFallbackUser();
    return NextResponse.json({
      success: true,
      user,
      role: null,
      isCoordinatorPortal: false,
    });
  }

  let isCoordinatorPortal = false;
  if (current.profile.status === 'approved') {
    const admin = getSupabaseAdmin(PROFILES_SCHEMA);
    if (admin) {
      const { data: orgRows, error: orgErr } = await admin
        .from('organization_members')
        .select('id')
        .eq('user_id', current.user.id)
        .eq('is_active', true)
        .in('org_role', [...COORDINATOR_ELIGIBLE_ORG_ROLES])
        .limit(1);
      if (!orgErr) {
        isCoordinatorPortal = (orgRows?.length ?? 0) > 0;
      }
    }
  }

  return NextResponse.json({
    success: true,
    user: current.user,
    role: current.profile.role,
    status: current.profile.status,
    isCoordinatorPortal,
  });
}

/**
 * Profil satırı yoksa (ör. trigger henüz çalışmamış) oturum yine de geçerli
 * olabilir. Bu durumda rol bilinmediği için `null` döneriz.
 */
async function getFallbackUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const { getSessionUser } = await import('@/lib/auth');
  return getSessionUser();
}
