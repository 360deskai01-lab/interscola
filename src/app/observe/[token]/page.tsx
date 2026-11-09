import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ObserverReportView } from '@/components/observer/ObserverReportView';
import { ObserverViewClient } from '@/components/observer/ObserverViewClient';
import { loadObserverReportByToken } from '@/lib/observer/load-observer-data';
import { OBSERVER_INVALID_TOKEN_ERROR } from '@/lib/observer/observer-dashboard-types';
import { getObserverDashboardDataAction } from './observer-view-actions';

export const instant = false;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEX_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

function Unavailable({ message }: { message: string }): ReactNode {
  return (
    <div className="min-h-dvh bg-slate-950 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export default async function ObserveStudentPage(props: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  await connection();

  const { token } = await props.params;

  if (HEX_TOKEN_PATTERN.test(token)) {
    const result = await getObserverDashboardDataAction(token);
    if (!result.success) {
      if (result.error === OBSERVER_INVALID_TOKEN_ERROR) {
        return (
          <Unavailable message="Bu veli takip bağlantısı geçersiz veya süresi dolmuş." />
        );
      }
      return (
        <Unavailable message="Gözlemci görünümü şu an kullanılamıyor." />
      );
    }
    return <ObserverViewClient data={result.data} />;
  }

  if (!UUID_PATTERN.test(token)) notFound();

  const loaded = await loadObserverReportByToken(token);

  if (!loaded.ok) {
    if (loaded.reason === 'not_found') notFound();
    return (
      <Unavailable message="Gözlemci görünümü şu an kullanılamıyor." />
    );
  }

  return <ObserverReportView data={loaded.data} />;
}
