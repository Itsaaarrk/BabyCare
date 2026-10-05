import type { Activity, ActivityRecord, ActivityType } from '@/types/activity';

export interface ActivityMeta {
  label: string;
  /** Button label on the home screen. */
  action: string;
  /** Present participle for a running timer, e.g. "Sleeping". */
  running: string;
  /** Label of the button that ends the timer. */
  finish: string;
}

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  feeding: { label: 'Feeding', action: 'Feed', running: 'Feeding', finish: 'Finish feeding' },
  diaper: { label: 'Diaper', action: 'Diaper', running: 'Diaper', finish: 'Done' },
  sleep: { label: 'Sleep', action: 'Sleep', running: 'Sleeping', finish: 'Wake up' },
  bath: { label: 'Bath', action: 'Bath', running: 'Bathing', finish: 'Finish bath' },
  // Neutral wording on purpose: the app makes no claims about sunlight exposure.
  outdoor: {
    label: 'Outdoor / Sunlight',
    action: 'Outdoor',
    running: 'Outdoors',
    finish: 'Finish outdoor time',
  },
  note: { label: 'Note', action: 'Note', running: 'Note', finish: 'Done' },
};

const FEEDING_LABELS = { breast: 'Breastfeeding', bottle: 'Bottle', formula: 'Formula', other: 'Other' } as const;
const DIAPER_LABELS = { pee: 'Pee', poop: 'Poop', both: 'Pee + Poop', dry: 'Dry' } as const;
const BATH_LABELS = { afternoon: 'Afternoon bath', night: 'Night bath', other: 'Bath' } as const;
const SIDE_LABELS = { left: 'left', right: 'right', both: 'both sides' } as const;

export const FEEDING_TYPE_LABELS = FEEDING_LABELS;
export const DIAPER_TYPE_LABELS = DIAPER_LABELS;
export const BATH_TYPE_LABELS = BATH_LABELS;
export const SIDE_TYPE_LABELS = SIDE_LABELS;

/** The title line for a timeline row, e.g. "Night bath" or "Pee + Poop". */
export function activityTitle(activity: Pick<ActivityRecord, 'type' | 'details'>): string {
  const d = activity.details;
  switch (activity.type) {
    case 'bath':
      return d?.bathType ? BATH_LABELS[d.bathType] : ACTIVITY_META.bath.label;
    case 'diaper':
      return d?.diaperType ? `Diaper · ${DIAPER_LABELS[d.diaperType]}` : ACTIVITY_META.diaper.label;
    case 'note':
      return d?.title || ACTIVITY_META.note.label;
    default:
      return ACTIVITY_META[activity.type].label;
  }
}

/** Secondary details, e.g. "Breastfeeding · left" or "Bottle · 120 ml". */
export function activityDetailLine(activity: Pick<ActivityRecord, 'type' | 'details' | 'notes'>): string {
  const d = activity.details;
  const parts: string[] = [];
  if (activity.type === 'feeding' && d?.feedingType) {
    parts.push(FEEDING_LABELS[d.feedingType]);
    if (d.feedingType === 'breast' && d.side) parts.push(SIDE_LABELS[d.side]);
    if (d.amount) parts.push(`${d.amount} ${d.amountUnit ?? 'ml'}`);
  }
  if (activity.type === 'note' && activity.notes) parts.push(activity.notes);
  return parts.join(' · ');
}

export const activityKey = (a: Pick<Activity, 'roomId' | 'babyId'>) => `${a.roomId}/${a.babyId}`;
