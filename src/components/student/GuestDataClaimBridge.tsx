'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  claimGuestDiagnosticExamAction,
  claimGuestSimulationsAction,
} from '@/app/student/claim-guest-actions';
import {
  clearGuestBudgetLead,
  clearGuestScholarshipLead,
  readGuestBudgetLead,
  readGuestScholarshipLead,
} from '@/lib/guest-lead/storage';
import {
  clearGuestDiagnosticClaimFromStorage,
  readGuestDiagnosticClaimFromStorage,
} from '@/lib/test-et/guest-diagnostic-claim-storage';

export function GuestDataClaimBridge(): ReactNode {
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const scholarship = readGuestScholarshipLead();
    const budget = readGuestBudgetLead();
    const diagnostic = readGuestDiagnosticClaimFromStorage();

    if (!scholarship && !budget && !diagnostic) return;

    void (async () => {
      const messages: string[] = [];

      if (scholarship || budget) {
        const simResult = await claimGuestSimulationsAction({
          scholarship: scholarship ?? undefined,
          budget: budget ?? undefined,
        });
        if (simResult.success) {
          if (scholarship) clearGuestScholarshipLead();
          if (budget) clearGuestBudgetLead();
          messages.push(
            '🎉 Misafirken çözdüğünüz burs/bütçe simülasyonu profilinize başarıyla aktarıldı!',
          );
        }
      }

      if (diagnostic) {
        const diagResult = await claimGuestDiagnosticExamAction(diagnostic);
        if (diagResult.success) {
          clearGuestDiagnosticClaimFromStorage();
          messages.push(
            '🎉 Misafirken çözdüğünüz teşhis sınavı başarınız öğrenci portföyünüze aktarıldı!',
          );
        }
      }

      if (messages.length > 0) {
        setNotice(messages.join(' '));
      }
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
