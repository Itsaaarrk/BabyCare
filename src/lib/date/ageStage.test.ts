import {
  AGE_STAGES,
  AGE_STAGE_LABELS,
  ageStageFor,
  ageStageForMonths,
  ageStageLabel,
} from './ageStage';

// Local noon on a fixed day, so the result never depends on when the tests run.
const TODAY = new Date(2026, 9, 5, 12, 0);

describe('ageStageForMonths', () => {
  it('moves up exactly at 3, 6 and 12 months and at 2, 3 and 5 years', () => {
    const edges: [number, string, string][] = [
      [2, 'months_0_3', 'months_0_3'],
      [3, 'months_0_3', 'months_3_6'],
      [6, 'months_3_6', 'months_6_12'],
      [12, 'months_6_12', 'years_1_2'],
      [24, 'years_1_2', 'years_2_3'],
      [36, 'years_2_3', 'years_3_5'],
      [60, 'years_3_5', 'years_5_plus'],
    ];
    for (const [months, before, after] of edges) {
      expect(ageStageForMonths(months - 1)).toBe(before);
      expect(ageStageForMonths(months)).toBe(after);
    }
  });

  it('starts at the first stage and never runs out of stages', () => {
    expect(ageStageForMonths(0)).toBe('months_0_3');
    expect(ageStageForMonths(120)).toBe('years_5_plus');
    expect(ageStageForMonths(1200)).toBe('years_5_plus');
  });

  it('covers every stage with a label', () => {
    for (const stage of AGE_STAGES) expect(AGE_STAGE_LABELS[stage]).toBeTruthy();
  });
});

describe('ageStageFor', () => {
  it('works from the date of birth', () => {
    expect(ageStageFor('2026-10-05', TODAY)).toBe('months_0_3'); // born today
    expect(ageStageFor('2026-07-05', TODAY)).toBe('months_3_6'); // exactly 3 months
    expect(ageStageFor('2026-07-06', TODAY)).toBe('months_0_3'); // a day short of 3 months
    expect(ageStageFor('2025-10-05', TODAY)).toBe('years_1_2'); // exactly 1 year
    expect(ageStageFor('2025-10-06', TODAY)).toBe('months_6_12'); // a day short of 1 year
    expect(ageStageFor('2023-10-05', TODAY)).toBe('years_3_5');
    expect(ageStageFor('2021-10-05', TODAY)).toBe('years_5_plus');
  });

  it('counts a month as complete only when its day-of-month is reached', () => {
    // Born Aug 31; on Nov 30 that is 2 completed months, not 3.
    expect(ageStageFor('2026-08-31', new Date(2026, 10, 30, 12))).toBe('months_0_3');
    expect(ageStageFor('2026-08-30', new Date(2026, 10, 30, 12))).toBe('months_3_6');
  });

  it('gives no stage for dates that cannot be used', () => {
    expect(ageStageFor('2026-10-06', TODAY)).toBeNull(); // tomorrow
    expect(ageStageFor('2999-01-01', TODAY)).toBeNull();
    expect(ageStageFor('2026-02-30', TODAY)).toBeNull();
    expect(ageStageFor('not a date', TODAY)).toBeNull();
    expect(ageStageFor('', TODAY)).toBeNull();
  });
});

describe('ageStageLabel', () => {
  it('names the stage the way parents expect', () => {
    expect(ageStageLabel('2026-09-22', TODAY)).toBe('Newborn');
    expect(ageStageLabel('2026-02-05', TODAY)).toBe('Baby'); // 8 months
    expect(ageStageLabel('2025-08-05', TODAY)).toBe('Toddler'); // 14 months
    expect(ageStageLabel('2024-10-05', TODAY)).toBe('Toddler'); // 2 years
    expect(ageStageLabel('2022-10-05', TODAY)).toBe('Preschooler'); // 4 years
    expect(ageStageLabel('2019-10-05', TODAY)).toBe('Child'); // 7 years
  });

  it('is empty when there is no usable date', () => {
    expect(ageStageLabel('', TODAY)).toBe('');
    expect(ageStageLabel('2999-01-01', TODAY)).toBe('');
  });
});
