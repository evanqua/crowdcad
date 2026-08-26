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

    setLoading(true);
    // A live subscription rather than a one-time get(): right after sign-in
    // there's a window where the ID token Firestore uses hasn't finished
    // propagating yet, so the very first read can fail with
    // permission-denied even though the user really is signed in. A
    // one-time fetch has no way to recover from that (it resolves to "not
    // admin" and just stays that way until something re-triggers the
    // effect, e.g. a full page reload) — a subscription keeps the
    // connection open and the SDK retries automatically, so it corrects
    // itself within the same page load once the token is ready.
    const unsubscribe = dbService.subscribeToDocument<UserDoc>(
      'users',
      user.uid,
      (snap) => {
        setIsAdmin(Boolean(snap.exists && snap.data?.isAdmin));
        setLoading(false);
      },
      () => {
        setIsAdmin(false);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, ready]);

  return { isAdmin, loading };
}
