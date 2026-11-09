'use client';

import { Copy, Loader2, Shield, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import {
  createObserverTokenAction,
  listStudentObserverTokensAction,
  revokeObserverTokenAction,
  type StudentObserverTokenRow,
} from '@/app/student/observer-actions';

interface StudentObserverLinkPanelProps {
  initialTokens: StudentObserverTokenRow[];
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function StudentObserverLinkPanel({
  initialTokens,
}: StudentObserverLinkPanelProps): ReactNode {
  const router = useRouter();
  const [tokens, setTokens] = useState(initialTokens);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createObserverTokenAction({
        label: 'Veli / gözlemci',
      });
      if (!result.success) {
        setError(result.error ?? 'Link oluşturulamadı.');
        return;
      }
      const list = await listStudentObserverTokensAction();
      if (list.success && list.tokens) {
        setTokens(list.tokens);
      } else if (result.row) {
        setTokens((prev) => [result.row!, ...prev]);
      }
      router.refresh();
      if (result.row) {
        await copyUrl(result.row.id, result.row.observeUrl);
      }
    });
  }

  async function copyUrl(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Panoya kopyalanamadı.');
    }
  }

  function handleRevoke(tokenId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeObserverTokenAction(tokenId);
      if (!result.success) {
        setError(result.error ?? 'Bağlantı iptal edilemedi.');
        return;
      }
      setTokens((prev) =>
        prev.map((row) =>
          row.id === tokenId ? { ...row, isActive: false } : row,
        ),
      );
      router.refresh();
    });
  }

  const activeTokens = tokens.filter((t) => t.isActive);

  return (
    <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Shield className="size-4 text-indigo-200" aria-hidden />
        <p className="text-sm font-medium text-indigo-50">
          👨‍👩‍👧 Veli / Gözlemci Bağlantısı
        </p>
        <span className="text-[10px] text-indigo-200/70">Salt okunur · 90 gün</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Şifresiz veli takibi: hedef puan, deneme geçmişi ve Weakness Ledger özeti.
      </p>

      {error ? (
        <p className="mt-2 text-xs text-rose-200/90" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/35 bg-indigo-500/25 px-4 py-2 text-xs font-semibold text-indigo-50 transition hover:bg-indigo-500/35 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : null}
          Yeni Veli Takip Linki Üret
        </button>
      </div>

      {activeTokens.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {activeTokens.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-white/10 bg-slate-900/50 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-slate-300">
                    {row.observeUrl}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Geçerlilik: {formatExpiry(row.expiresAt)}
                    {row.label ? ` · ${row.label}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => copyUrl(row.id, row.observeUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                  >
                    <Copy className="size-3.5" />
                    {copiedId === row.id ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(row.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-60"
                  >
                    <Trash2 className="size-3.5" />
                    İptal et
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Aktif bağlantı yok. Yukarıdaki düğmeyle yeni link üretebilirsin.
        </p>
      )}

      {tokens.some((t) => !t.isActive) ? (
        <p className="mt-3 text-[10px] text-slate-600">
          İptal edilen {tokens.filter((t) => !t.isActive).length} bağlantı geçmişte
          listelenir; artık erişilemez.
        </p>
      ) : null}
    </div>
  );
}
