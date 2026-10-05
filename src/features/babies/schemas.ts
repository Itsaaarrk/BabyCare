import { z } from 'zod';

import { calculateAge, parseDateString } from '@/lib/date/age';

export const GENDERS = ['girl', 'boy', 'other'] as const;

const optionalText = (max: number, message: string) => z.string().trim().max(max, message);

export const babyFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter your baby’s name').max(60, 'Name is too long'),
  nickname: optionalText(40, 'Nickname is too long'),
  birthDate: z
    .string()
    .refine((value) => parseDateString(value) !== null, 'Choose a valid birth date')
    .refine((value) => calculateAge(value) !== null, 'Birth date can’t be in the future'),
  birthTime: z.string().refine((value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: 'Use a valid time',
  }),
  gender: z.enum(GENDERS).optional(),
  notes: optionalText(1000, 'Notes are too long'),
});

export type BabyFormValues = z.infer<typeof babyFormSchema>;
