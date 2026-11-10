import { z } from 'zod';

const email = z.string().email();
const password = z.string().superRefine((value, ctx) => {
  if (value.length < 8) ctx.addIssue({ code: 'custom', message: 'Password must be at least 8 characters' });
  else if (!/[A-Z]/.test(value)) ctx.addIssue({ code: 'custom', message: 'Password must contain an uppercase letter' });
  else if (!/\d/.test(value)) ctx.addIssue({ code: 'custom', message: 'Password must contain a digit' });
});

export const registerSchema = z.object({ email, full_name: z.string().transform((v) => v.trim()).refine(Boolean, 'Full name cannot be empty'), password });
export const loginSchema = z.object({ email, password: z.string() });
export const refreshSchema = z.object({ refresh_token: z.string() });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string(), new_password: password });
export const twoFactorSchema = z.object({ user_id: z.string(), code: z.string() });
export const resendSchema = z.object({ email });
export const updateProfileSchema = z.object({
  full_name: z.string().nullable().optional(), email: email.nullable().optional(), current_password: z.string().nullable().optional(),
  new_password: password.nullable().optional(), bio: z.string().nullable().optional(), headline: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(), company: z.string().nullable().optional(), school: z.string().nullable().optional(),
  phone: z.string().nullable().optional(), website: z.string().nullable().optional(), city: z.string().nullable().optional(),
  country: z.string().nullable().optional(), address: z.string().nullable().optional(), linkedin_url: z.string().nullable().optional(),
  twitter_url: z.string().nullable().optional(), github_url: z.string().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.full_name != null && !value.full_name.trim()) ctx.addIssue({ code: 'custom', path: ['full_name'], message: 'Full name cannot be empty' });
});
