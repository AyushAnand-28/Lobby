"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";

import { getSiteUrl, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, magicLinkSchema, signupSchema } from "@/lib/validation/auth";
import type { AuthFormState } from "./form-state";
import { safeNextPath } from "./redirect";

const NOT_CONFIGURED =
  "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.";

/**
 * Shown after signup and after a magic link request, regardless of whether the
 * address is already registered. Supabase deliberately does not distinguish
 * the two, and neither should we — a different message here would turn the
 * form into an account-existence oracle.
 */
function checkYourInbox(email: string): string {
  return `Check ${email} for a link from us. It expires in an hour.`;
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");
  const values = { email };
  const next = safeNextPath(readField(formData, "next"));

  if (!isSupabaseConfigured()) {
    return { status: "error", message: NOT_CONFIGURED, values };
  }

  const parsed = loginSchema.safeParse({
    email,
    password: readField(formData, "password"),
  });
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: describeAuthError(error), values };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function magicLinkAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");
  const values = { email };
  const next = safeNextPath(readField(formData, "next"));

  if (!isSupabaseConfigured()) {
    return { status: "error", message: NOT_CONFIGURED, values };
  }

  const parsed = magicLinkSchema.safeParse({ email });
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callbackUrl(next),
      // Magic links sign existing organizers in; they do not create accounts.
      // A new organizer needs the signup form, which collects a display name.
      shouldCreateUser: false,
    },
  });

  // "Signups not allowed for otp" means the address has no account. Surfacing
  // that would leak which emails are registered, so it reports success too.
  if (error && !isUnknownAccountError(error)) {
    return { status: "error", message: describeAuthError(error), values };
  }

  return { status: "success", message: checkYourInbox(parsed.data.email) };
}

export async function signupAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = {
    displayName: readField(formData, "displayName"),
    email: readField(formData, "email"),
    phone: readField(formData, "phone"),
  };

  if (!isSupabaseConfigured()) {
    return { status: "error", message: NOT_CONFIGURED, values };
  }

  const parsed = signupSchema.safeParse({
    displayName: values.displayName,
    email: values.email,
    phone: values.phone,
    password: readField(formData, "password"),
    confirmPassword: readField(formData, "confirmPassword"),
  });
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl("/dashboard"),
      // Carried on the auth user for now. When the `organizers` table lands, a
      // trigger on auth.users copies these into the profile row.
      data: {
        display_name: parsed.data.displayName,
        phone: parsed.data.phone ?? null,
      },
    },
  });

  if (error) {
    return { status: "error", message: describeAuthError(error), values };
  }

  return { status: "success", message: checkYourInbox(parsed.data.email) };
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// --- helpers ---------------------------------------------------------------

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function invalid(error: z.ZodError, values: Record<string, string>): AuthFormState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values,
  };
}

/** Absolute URL Supabase redirects to after the emailed link is followed. */
function callbackUrl(next: string): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function isUnknownAccountError(error: AuthError): boolean {
  return (
    error.code === "otp_disabled" ||
    error.message.toLowerCase().includes("signups not allowed")
  );
}

/** Supabase messages are terse and developer-facing. These are not. */
function describeAuthError(error: AuthError): string {
  /*
   * Network failures arrive before any Supabase error code is assigned, so
   * they fall through the switch below and surface `error.message` verbatim —
   * which is the raw undici string "fetch failed". That tells a user nothing
   * and sends a developer looking at their password instead of their config.
   *
   * The usual cause is NEXT_PUBLIC_SUPABASE_URL pointing at a project that is
   * paused, deleted, or was never created: the hostname then does not resolve
   * at all.
   */
  if (isUnreachable(error)) {
    return (
      "Could not reach the authentication server. Check that " +
      "NEXT_PUBLIC_SUPABASE_URL in .env.local points at a Supabase project " +
      "that exists and is not paused, then restart the dev server."
    );
  }

  switch (error.code) {
    case "invalid_credentials":
      return "That email and password do not match.";
    case "email_not_confirmed":
      return "Confirm your email address first. Check your inbox for the link.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "user_already_exists":
      return "An account with that email already exists. Try logging in.";
    case "weak_password":
      return "That password is too weak. Use a longer mix of letters and numbers.";
    default:
      return error.message;
  }
}

/**
 * True when the request never reached Supabase.
 *
 * `AuthRetryableFetchError` is what supabase-js wraps a failed fetch in, and it
 * carries status 0 because there was no response. The message check is a
 * belt-and-braces fallback for runtimes that surface the underlying TypeError
 * without that class.
 */
function isUnreachable(error: AuthError): boolean {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    /fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(error.message)
  );
}
