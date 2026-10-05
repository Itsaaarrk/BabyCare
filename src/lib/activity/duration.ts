export const MAX_DURATION_SECONDS = 48 * 3600;

export function durationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

/** Compact form for lists and totals: "1h 35m", "18m", "45s". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Spoken form for screen readers: "1 hour 35 minutes". */
export function formatDurationLong(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour');
  if (m > 0) return unit(m, 'minute');
  return unit(total, 'second');
}

/** Running-timer clock: "01:24:12". */
export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** "42 min ago", "1h 15m ago", "just now". */
export function formatAgo(ms: number, now: number): string {
  const seconds = Math.floor((now - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  if (h >= 48) return `${Math.floor(h / 24)} days ago`;
  return `${h}h ${minutes % 60}m ago`;
}
