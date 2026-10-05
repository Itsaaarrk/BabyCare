import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email'));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name').max(60, 'Name is too long'),
  email,
  password: z.string().min(8, 'Use at least 8 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
