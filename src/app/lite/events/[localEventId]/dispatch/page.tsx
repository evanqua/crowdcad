'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import SharedDispatchPage from '@/app/(main)/events/[eventId]/dispatch/page';

export default function LiteDispatchPage() {
  const params = useParams();
  const localEventId = String(params?.localEventId ?? '');

  const sharedParams = useMemo(
    () => Promise.resolve({ eventId: localEventId }),
    [localEventId]
  );

  return (
    <SharedDispatchPage
      params={sharedParams}
      liteEventId={localEventId}
      forceLiteMode={true}
    />
  );
}
