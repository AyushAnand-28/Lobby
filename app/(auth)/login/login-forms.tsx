"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, fieldError } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginAction, magicLinkAction } from "@/lib/auth/actions";
import { initialAuthFormState } from "@/lib/auth/form-state";

/**
 * Two ways in, same screen.
 *
 * Each tab owns its own action state so a failed password attempt does not
 * bleed an error message into the magic link tab.
 *
 * `next` rides along in a hidden input rather than being read from the URL
 * inside the action — the action re-validates it either way (`safeNextPath`),
 * so a tampered value degrades to the dashboard rather than an open redirect.
 */
export function LoginForms({ next }: { next: string }) {
  const [passwordState, passwordSubmit] = useActionState(
    loginAction,
    initialAuthFormState,
  );
  const [magicState, magicSubmit] = useActionState(
    magicLinkAction,
    initialAuthFormState,
  );

  return (
    <Tabs defaultValue="password" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="magic-link">Email link</TabsTrigger>
      </TabsList>

      <TabsContent value="password">
        <form action={passwordSubmit} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <FormAlert state={passwordState} />

          <Field
            id="login-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            defaultValue={passwordState.values?.email}
            error={fieldError(passwordState.fieldErrors, "email")}
          />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={fieldError(passwordState.fieldErrors, "password")}
          />

          <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
        </form>
      </TabsContent>

      <TabsContent value="magic-link">
        <form action={magicSubmit} className="grid gap-4">
          <input type="hidden" name="next" value={next} />
          <FormAlert state={magicState} />

          <Field
            id="magic-link-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            defaultValue={magicState.values?.email}
            hint="We email you a link that logs you straight in. No password needed."
            error={fieldError(magicState.fieldErrors, "email")}
          />

          <SubmitButton pendingLabel="Sending…">Email me a link</SubmitButton>
        </form>
      </TabsContent>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an organizer account
        </Link>
      </p>
    </Tabs>
  );
}
