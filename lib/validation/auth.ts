import { z } from "zod";

/**
 * All auth input validation. Zod v4.
 *
 * These schemas guard shape and basic policy only — Supabase Auth remains the
 * authority on credentials, rate limiting and password storage.
 */

/** Trim and lowercase before validating, so " Vivek@Example.COM " logs in fine. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

/**
 * 72 bytes is the bcrypt ceiling Supabase enforces; anything longer is
 * silently truncated, which would be a confusing way to fail.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use 72 characters or fewer." })
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    error: "Include at least one letter and one number.",
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Enter your name." })
  .max(80, { error: "Use 80 characters or fewer." });

/**
 * Deliberately permissive: organizers are local and college clubs, and a
 * strict E.164 rule would reject the way most of them actually write a number.
 * Empty string is normalised to undefined so the column stays null.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .refine((value) => value === undefined || /^\+?[\d\s()-]{7,20}$/.test(value), {
    error: "Enter a valid phone number.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  // Login only checks presence — policy errors belong on signup, and telling a
  // login form "your password is too short" leaks that it is being compared.
  password: z.string().min(1, { error: "Enter your password." }),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const signupSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    phone: phoneSchema.optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
