"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, fieldError } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { signupAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";

export function SignupForm() {
  const [state, submit] = useActionState(signupAction, initialAuthFormState);

  // On success the account exists but is unverified, so there is nothing to
  // log into yet. Swap the form for the "check your inbox" message rather than
  // leaving a filled-in form the organizer might submit again.
  if (state.status === "success") {
    return (
      <div className="grid gap-4">
        <FormAlert state={state} />
        <p className="text-sm text-muted-foreground">
          Follow the link in that email to finish setting up your account. You can
          close this tab.
        </p>
        <p className="text-sm text-muted-foreground">
          Wrong address, or nothing arrived?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Start again
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="grid gap-4">
      <FormAlert state={state} />

      <Field
        name="displayName"
        label="Your name"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName}
        error={fieldError(state.fieldErrors, "displayName")}
      />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={fieldError(state.fieldErrors, "email")}
      />
      <Field
        name="phone"
        label="Phone"
        type="tel"
        autoComplete="tel"
        defaultValue={state.values?.phone}
        hint="Optional. Shown to team captains so they can reach you."
        error={fieldError(state.fieldErrors, "phone")}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters, with a number."
        error={fieldError(state.fieldErrors, "password")}
      />
      <Field
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldError(state.fieldErrors, "confirmPassword")}
      />

      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
