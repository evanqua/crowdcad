'use client';
import { useCallback, useEffect, useState } from 'react';
import { getCertifications, setCertifications, DEFAULT_CERTIFICATIONS } from '@/lib/certificationsService';

export function useCertifications() {
  const [certifications, setCertificationsState] = useState<string[]>(DEFAULT_CERTIFICATIONS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCertificationsState(await getCertifications());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (list: string[]) => {
    await setCertifications(list);
    setCertificationsState(list);
  }, []);

  return { certifications, loading, save, refresh };
}
