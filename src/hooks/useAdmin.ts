'use client';
import { useEffect, useState } from 'react';
import { useAuth } from './useauth';
import { dbService } from '@/lib/services';
import type { UserDoc } from '@/lib/userDoc';

export function useAdmin() {
  const { user, ready } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    dbService
      .getDocument<UserDoc>('users', user.uid)
      .then((snap) => {
        if (cancelled) return;
        setIsAdmin(Boolean(snap.exists && snap.data?.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  return { isAdmin, loading };
}
