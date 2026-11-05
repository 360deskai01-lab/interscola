'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { claimGuestSimulationsAction } from '@/app/student/claim-guest-actions';
import {
  clearGuestBudgetLead,
  clearGuestScholarshipLead,
  readGuestBudgetLead,
  readGuestScholarshipLead,
} from '@/lib/guest-lead/storage';

export function GuestDataClaimBridge(): ReactNode {
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const scholarship = readGuestScholarshipLead();
    const budget = readGuestBudgetLead();
    if (!scholarship && !budget) return;

    void (async () => {
      const result = await claimGuestSimulationsAction({
        scholarship: scholarship ?? undefined,
        budget: budget ?? undefined,
      });

      if (!result.success) {
        return;
      }

      if (scholarship) clearGuestScholarshipLead();
      if (budget) clearGuestBudgetLead();

      setNotice(
        '🎉 Misafirken çözdüğünüz burs/bütçe simülasyonu profilinize başarıyla aktarıldı!',
      );
    })();
  }, []);

  if (!notice) return null;

  return (
    <div
      role="status"
      className="rounded-2xl border border-emerald-400/35 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/10 px-4 py-3 text-sm font-medium text-emerald-50 shadow-lg shadow-emerald-950/20"
    >
      {notice}
    </div>
  );
}
