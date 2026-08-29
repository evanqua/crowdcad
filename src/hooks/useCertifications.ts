'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useauth';
import { getCertifications, setCertifications, DEFAULT_CERTIFICATIONS } from '@/lib/certificationsService';

export function useCertifications() {
  const { user, ready } = useAuth();
  const [certifications, setCertificationsState] = useState<string[]>(DEFAULT_CERTIFICATIONS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Signed-out (lite/local mode): the settings doc requires auth to read,
    // so don't even try — just use the built-in list.
    if (!user) {
      setCertificationsState(DEFAULT_CERTIFICATIONS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCertificationsState(await getCertifications());
    } catch {
      // Same shared-settings read every other signed-in user relies on —
      // if it's ever unreadable, fall back rather than surface an error.
      setCertificationsState(DEFAULT_CERTIFICATIONS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Wait for auth to resolve before querying — firing while
    // request.auth is still null (e.g. on a hard refresh, before
    // onAuthStateChanged has reported the restored session) trips the
    // settings collection's `request.auth != null` rule and throws
    // "Missing or insufficient permissions" even for a user who is about
    // to be signed in a moment later.
    if (!ready) return;
    refresh();
  }, [ready, refresh]);

  const save = useCallback(async (list: string[]) => {
    await setCertifications(list);
    setCertificationsState(list);
  }, []);

  return { certifications, loading, save, refresh };
}
