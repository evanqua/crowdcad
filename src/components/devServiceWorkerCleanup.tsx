"use client";
import { useEffect } from "react";

export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!('serviceWorker' in navigator)) return;

    // Unregister any service workers that may be serving stale _next assets
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        try {
          r.unregister();
        } catch {
          // ignore
        }
      });
    }).catch(() => {});
  }, []);

  return null;
}
