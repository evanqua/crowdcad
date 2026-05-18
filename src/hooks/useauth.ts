'use client';
import { useEffect, useState } from 'react';
import { authService, type ServiceUser } from '@/lib/services';

export function useAuth() {
  const [user, setUser] = useState<ServiceUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((u) => {
      setUser(u);
      setReady(true);
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