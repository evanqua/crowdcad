'use client';
import { useEffect, useState } from 'react';
import { authService, dbService, isPocketbaseBackend, type ServiceUser } from '@/lib/services';

// Tracks which uids have already had their `users/{uid}` doc synced with
// email/displayName this session, so the merge write below only fires once
// per user even though many components mount useAuth() independently.
const syncedUids = new Set<string>();

export function useAuth() {
  const [user, setUser] = useState<ServiceUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);

      // Best-effort sync so the users collection has enough info (email,
      // displayName) for the admin "Manage Admins" lookup — the doc is
      // otherwise only ever written with partial fields (phoneNumber, etc).
      // PocketBase's `users` collection is the built-in auth collection and
      // already has these as native fields — writing `email` there could
      // trigger its email-change/verification flow, so skip it there.
      if (u && !isPocketbaseBackend && !syncedUids.has(u.uid)) {
        syncedUids.add(u.uid);
        dbService
          .setDocument('users', u.uid, { email: u.email, displayName: u.displayName }, { merge: true })
          .catch(() => {
            syncedUids.delete(u.uid);
          });
      }
    });
    return () => unsub();
  }, []);

  // AFTER you set your local user + ready state:
  if (typeof document !== 'undefined') {
    if (user) {
      // 7 days; adjust as you like
      document.cookie = 'ccad_auth=1; Max-Age=604800; Path=/; SameSite=Lax';
    } else {
      document.cookie = 'ccad_auth=0; Max-Age=0; Path=/; SameSite=Lax';
    }
  }
  
  return { user, ready };
}