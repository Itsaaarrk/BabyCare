import { formatDuration } from '@/lib/activity/duration';
import type { Summary } from '@/lib/activity/summary';

/**
 * The shareable daily summary, in plain text. Sections for activities the user turned off are
 * left out, and a day with no activity says so rather than printing zeros.
 */
export function dailySummaryText(
  babyName: string,
  dateLabel: string,
  s: Summary,
  enabled: { feeding: boolean; diaper: boolean; sleep: boolean; bath: boolean; outdoor: boolean },
): string {
  const lines = [`${babyName.toUpperCase()}'S DAY`, dateLabel, ''];
  const sessions = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`;

  if (s.total === 0) {
    lines.push('Nothing logged.');
    return lines.join('\n');
  }
  if (enabled.feeding) {
    lines.push('🍼 Feeding', sessions(s.feeding.count), `${formatDuration(s.feeding.totalSeconds)} total`, '');
  }
  if (enabled.diaper) {
    const d = s.diaper;
    lines.push('🧷 Diapers', `${d.total} total`);
    if (d.pee) lines.push(`${d.pee} Pee`);
    if (d.poop) lines.push(`${d.poop} Poop`);
    if (d.both) lines.push(`${d.both} Pee + Poop`);
    lines.push('');
  }
  if (enabled.sleep) {
    lines.push('😴 Sleep', sessions(s.sleep.count), `${formatDuration(s.sleep.totalSeconds)} total`, '');
  }
  if (enabled.bath) {
    lines.push('🛁 Bath', sessions(s.bath.count), formatDuration(s.bath.totalSeconds), '');
  }
  if (enabled.outdoor) {
    lines.push('☀️ Outdoor', formatDuration(s.outdoor.totalSeconds), '');
  }
  if (s.caregivers.length > 0) {
    lines.push('CAREGIVERS');
    for (const c of s.caregivers) lines.push(`${c.name}  ${c.count} ${c.count === 1 ? 'log' : 'logs'}`);
  }
  return lines.join('\n').trimEnd();
}
