import { useEffect, useState } from 'react';

/** Live-ticking elapsed seconds since `since` (epoch ms), updated every second. */
export function useElapsedSeconds(since?: number): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!since) return;
    const tick = () => setElapsed(Math.floor((Date.now() - since) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return elapsed;
}

export function formatMMSS(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Live-ticking `mm:ss` elapsed since `since` (epoch ms), updated every second. */
export function useMMSS(since?: number): string {
  return formatMMSS(useElapsedSeconds(since));
}
