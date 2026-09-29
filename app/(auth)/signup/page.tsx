import type { Metadata } from "next";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function SignupPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <p className="eyebrow text-brand">Get started</p>
        <h1 className="text-[clamp(1.75rem,1.5rem+1vw,2.5rem)]">
          Create an organizer account
        </h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Only organizers sign up. Captains register their team from a link, and
          spectators need nothing at all.
        </p>
      </div>

      <SignupForm />
    </div>
  );
}
