"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Submit button that disables itself while its parent form is in flight.
 *
 * `useFormStatus` only reads the *nearest* parent form, which is why this is a
 * separate component rather than a prop on the form.
 */
export function SubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      /*
       * `brand`, not `flame`. The primary action in this language is a white
       * block on the black ground; the accent colour is reserved for focus
       * rings and live state, and reads as a warning when it fills a button.
       */
      variant="brand"
      size="xl"
      disabled={pending}
      className={cn("w-full", className)}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
