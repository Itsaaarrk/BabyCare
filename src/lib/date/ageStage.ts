import { calculateAge } from './age';

/**
 * Where a child is in growing up, worked out from the date of birth alone. Nothing is stored, so a
 * child moves to the next stage on its own and old records are never touched.
 *
 * The stage may shape what the app suggests and how it talks. It must never remove a feature:
 * everything stays reachable at every age.
 */
export const AGE_STAGES = [
  'months_0_3',
  'months_3_6',
  'months_6_12',
  'years_1_2',
  'years_2_3',
  'years_3_5',
  'years_5_plus',
] as const;

export type AgeStage = (typeof AGE_STAGES)[number];

/** What to call each stage on screen. Neighbouring stages can share a name. */
export const AGE_STAGE_LABELS: Record<AgeStage, string> = {
  months_0_3: 'Newborn',
  months_3_6: 'Baby',
  months_6_12: 'Baby',
  years_1_2: 'Toddler',
  years_2_3: 'Toddler',
  years_3_5: 'Preschooler',
  years_5_plus: 'Child',
};

/** Completed months at which each stage ends: 3 months, 6 months, 1 year, 2 years, 3 years, 5 years. */
const STAGE_ENDS: readonly (readonly [AgeStage, number])[] = [
  ['months_0_3', 3],
  ['months_3_6', 6],
  ['months_6_12', 12],
  ['years_1_2', 24],
  ['years_2_3', 36],
  ['years_3_5', 60],
];

/** The stage for an age in completed months. */
export function ageStageForMonths(months: number): AgeStage {
  for (const [stage, end] of STAGE_ENDS) if (months < end) return stage;
  return 'years_5_plus';
}

/** The stage of someone born on `birthDate` (`YYYY-MM-DD`), or null for an invalid or future date. */
export function ageStageFor(birthDate: string, today: Date = new Date()): AgeStage | null {
  const age = calculateAge(birthDate, today);
  return age ? ageStageForMonths(age.months) : null;
}

/** "Newborn", "Toddler", ... or an empty string when the date can't be used. */
export function ageStageLabel(birthDate: string, today: Date = new Date()): string {
  const stage = ageStageFor(birthDate, today);
  return stage ? AGE_STAGE_LABELS[stage] : '';
}
