/**
 * Shared shape for the auth form actions.
 *
 * This lives outside `actions.ts` because a `"use server"` module may only
 * export async functions — a plain constant there is a build error.
 */

export type FieldErrors = Record<string, string[] | undefined>;

export type AuthFormState = {
  status: "idle" | "error" | "success";
  /** Form-level message, rendered in an alert above the fields. */
  message?: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: FieldErrors;
  /** Echoed back so a failed submit does not wipe what was typed. */
  values?: Record<string, string>;
};

export const initialAuthFormState: AuthFormState = { status: "idle" };
