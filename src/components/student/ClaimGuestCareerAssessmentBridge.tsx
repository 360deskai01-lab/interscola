'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

import { claimGuestAssessmentAction } from '@/app/career-compass/actions';
import {
  GUEST_QUICK_RESULT_STORAGE_KEY,
  GUEST_SESSION_STORAGE_KEY,
} from '@/lib/career-assessment/guest-session';

type Props = {
  /** Sunucu tarafı ilk yükleme (claim sonrası refresh ile güncellenir). */
  initialHasCareerAssessment: boolean;
};

/**
 * Öğrenci paneli mount: misafir `guest_session_id` kayıtlarını hesaba aktarır.
 */
export function ClaimGuestCareerAssessmentBridge({
  initialHasCareerAssessment: _initialHasCareerAssessment,
}: Props): null {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current || pending) return;

    const guestSessionId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim()
        : '';
    if (!guestSessionId) return;

    attemptedRef.current = true;

    startTransition(async () => {
      const result = await claimGuestAssessmentAction(guestSessionId);
      if (!result.success) {
        attemptedRef.current = false;
        return;
      }

      window.localStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(GUEST_QUICK_RESULT_STORAGE_KEY);
      router.refresh();
    });
  }, [pending, router]);

  return null;
}
