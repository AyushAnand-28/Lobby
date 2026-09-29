import type { Metadata } from "next";
import Link from "next/link";

import { TournamentForm } from "@/components/tournament/tournament-form";
import { requireUser } from "@/lib/auth/session";
import { createTournamentAction } from "@/lib/tournament/actions";

export const metadata: Metadata = {
  title: "New tournament",
};

export default async function NewTournamentPage() {
  await requireUser("/dashboard/tournaments/new");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-12">
      <div className="grid gap-6">
        <Link
          href="/dashboard"
          className="text-sm font-light text-foreground/55 underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All tournaments
        </Link>
        <p className="eyebrow text-foreground/55">New tournament</p>
        <h1 className="text-[clamp(2.25rem,5vw,4.5rem)] leading-none font-semibold">
          Set up the draw
        </h1>
        <p className="max-w-md text-base leading-relaxed font-light text-foreground/60">
          It starts as a draft that only you can see. Once it is published,
          you get one link to share with every captain.
        </p>
      </div>

      <TournamentForm
        action={createTournamentAction}
        submitLabel="Create tournament"
        pendingLabel="Creating…"
        footnote="Nobody can register until you publish it on the next screen."
      />
    </div>
  );
}
