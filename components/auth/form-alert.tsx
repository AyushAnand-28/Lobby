import { CircleAlertIcon, MailCheckIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthFormState } from "@/lib/auth/form-state";

/**
 * Form-level result banner. `aria-live` so a screen reader announces the
 * outcome of a submit that did not move focus.
 */
export function FormAlert({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";

  return (
    <div aria-live="polite">
      <Alert variant={isError ? "destructive" : "default"}>
        {isError ? (
          <CircleAlertIcon aria-hidden />
        ) : (
          <MailCheckIcon className="text-sport-accent" aria-hidden />
        )}
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    </div>
  );
}
