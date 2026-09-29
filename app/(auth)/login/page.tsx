import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/redirect";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <p className="eyebrow text-brand">Organizer access</p>
        <h1 className="text-[clamp(1.75rem,1.5rem+1vw,2.5rem)]">Welcome back</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Log in to manage your tournaments.
        </p>
      </div>

      <LoginForms next={safeNextPath(next)} />
    </div>
  );
}
