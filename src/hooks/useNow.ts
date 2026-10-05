import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` while `active`. Only tick when something on
 * screen needs it (a running timer, an "x min ago" label) so idle screens don't re-render.
 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
