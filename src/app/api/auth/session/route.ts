import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';

/**
 * Tarayıcının oturum durumunu öğrendiği uç nokta.
 * Oturum yoksa `user: null` döner (hata değil).
 * `role` alanı, arayüzde yönetim paneli butonunu göstermek için kullanılır.
 */
export async function GET() {
  const current = await getCurrentProfile();

  if (!current) {
    const user = await getFallbackUser();
    return NextResponse.json({ success: true, user, role: null });
  }

  return NextResponse.json({
    success: true,
    user: current.user,
    role: current.profile.role,
    status: current.profile.status,
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
