import { babyFormSchema } from './schemas';

const valid = {
  name: 'Sofia',
  nickname: '',
  birthDate: '2026-01-10',
  birthTime: '',
  notes: '',
};

describe('babyFormSchema', () => {
  it('accepts a minimal valid profile', () => {
    expect(babyFormSchema.safeParse(valid).success).toBe(true);
  });

  it('trims the name and requires it', () => {
    expect(babyFormSchema.parse({ ...valid, name: '  Sofia ' }).name).toBe('Sofia');
    expect(babyFormSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects future and impossible birth dates', () => {
    expect(babyFormSchema.safeParse({ ...valid, birthDate: '2999-01-01' }).success).toBe(false);
    expect(babyFormSchema.safeParse({ ...valid, birthDate: '2026-02-30' }).success).toBe(false);
  });

  it('validates birth time format when present', () => {
    expect(babyFormSchema.safeParse({ ...valid, birthTime: '23:59' }).success).toBe(true);
    expect(babyFormSchema.safeParse({ ...valid, birthTime: '24:00' }).success).toBe(false);
  });

  it('only allows known genders', () => {
    expect(babyFormSchema.safeParse({ ...valid, gender: 'girl' }).success).toBe(true);
    expect(babyFormSchema.safeParse({ ...valid, gender: 'robot' }).success).toBe(false);
  });
});
