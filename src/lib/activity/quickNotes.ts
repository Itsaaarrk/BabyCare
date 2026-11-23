import type { Activity } from '@/types/activity';

export interface QuickNoteOptions {
  /** Only notes that started at or after this time count. */
  since: number;
  /** A title must have been used at least this many times. */
  minUses?: number;
  /** At most this many titles are returned. */
  limit?: number;
}

/**
 * The note titles used most often, so they can be logged with one tap (e.g. "Burp").
 * Titles are matched ignoring case and surrounding spaces; the spelling used most recently wins.
 * Most used first, ties broken by the most recent use.
 */
export function frequentNoteTitles(
  activities: readonly Activity[],
  { since, minUses = 3, limit = 4 }: QuickNoteOptions,
): string[] {
  const byKey = new Map<string, { title: string; uses: number; lastUsed: number }>();
  for (const a of activities) {
    if (a.type !== 'note' || a.startedAt < since) continue;
    const title = a.details?.title?.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, { title, uses: 1, lastUsed: a.startedAt });
      continue;
    }
    entry.uses += 1;
    if (a.startedAt > entry.lastUsed) {
      entry.lastUsed = a.startedAt;
      entry.title = title;
    }
  }
  return [...byKey.values()]
    .filter((e) => e.uses >= minUses)
    .sort((a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed)
    .slice(0, limit)
    .map((e) => e.title);
}
