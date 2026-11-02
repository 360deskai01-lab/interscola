'use client';

import Link from 'next/link';
import { Target } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  loginUrlWithNext,
  STUDENT_DIAGNOSTIC_EXPLORE_PATH,
} from '@/lib/safe-next-path';

interface DiagnosticExploreLinkProps {
  className?: string;
  label?: string;
}

const DEFAULT_CLASS =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-500/12 px-3 py-2 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/22';

/**
 * Oturum varsa doğrudan keşfet/teşhis; yoksa login köprüsü (`next=`).
 */
export function DiagnosticExploreLink({
  className = DEFAULT_CLASS,
  label = 'Kabul Şansını Gör (15 Dk Teşhis Testi)',
}: DiagnosticExploreLinkProps): ReactNode {
  const [href, setHref] = useState(
    loginUrlWithNext(STUDENT_DIAGNOSTIC_EXPLORE_PATH),
  );
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveHref() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          setHref(STUDENT_DIAGNOSTIC_EXPLORE_PATH);
        }
      } catch {
        /* login köprüsü varsayılan kalır */
      } finally {
        if (!cancelled) {
          setResolved(true);
        }
      }
    }

    void resolveHref();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href={href} aria-busy={!resolved} className={className}>
      <Target className="size-3.5 shrink-0" />
      {label}
    </Link>
  );
}
