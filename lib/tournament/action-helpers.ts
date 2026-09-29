import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/form-state";

/**
 * Shared by the tournament Server Action modules. It lives outside them
 * because a `"use server"` module may only export async functions.
 */

export const SESSION_EXPIRED = "Your session has expired. Log in again to continue.";

export function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function readAll(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
}

export function invalidForm(
  fieldErrors: Record<string, string[] | undefined>,
  values: Record<string, string>,
): AuthFormState {
  return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors;
}

/** The short code a tournament function raised, from a PostgREST error. */
export function errorCode(error: { message?: string } | null | undefined): string | undefined {
  return error?.message?.trim() || undefined;
}
