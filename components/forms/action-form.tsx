"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/utils";

type ActionState = { error?: string; message?: string };

/**
 * A form around one Server Action that answers with a message or an error —
 * make the draw, reset it, draw the knockout. Any fields go in `children`.
 */
export function ActionForm({
  action,
  label,
  pendingLabel,
  variant = "primary",
  confirm,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  /** Asked before submitting, for actions that throw work away. */
  confirm?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [state, submit] = useActionState(action, {});

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={cn("grid gap-4", className)}
    >
      {children}
      <SubmitButton
        pendingLabel={pendingLabel}
        className={variant === "secondary" ? "bg-transparent text-foreground ring-1 ring-border hover:bg-mist" : undefined}
      >
        {label}
      </SubmitButton>
      <div aria-live="polite">
        {state.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
        {state.message ? <p className="text-sm font-light text-foreground/70">{state.message}</p> : null}
      </div>
    </form>
  );
}
