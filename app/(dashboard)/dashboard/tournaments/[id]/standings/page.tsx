import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bracket } from "@/components/tournament/bracket";
import { PodiumCard } from "@/components/tournament/podium";
import { RealtimeRefresh } from "@/components/tournament/realtime-refresh";
import { StandingsTable } from "@/components/tournament/standings-table";
import { requireUser } from "@/lib/auth/session";
import { getOrganizerTournament, loadTournamentView } from "@/lib/tournament/queries";

export const metadata: Metadata = {
  title: "Standings",
};

export default async function StandingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/standings`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament } = result;
  const base = `/dashboard/tournaments/${tournament.id}`;

  if (tournament.status !== "in_progress" && tournament.status !== "completed") {
    return (
      <p className="max-w-2xl border border-border bg-mist p-5 text-base font-light text-foreground/70">
        Standings appear once the draw is made.{" "}
        <Link href={`${base}/draw`} className="underline underline-offset-4">
          Go to the draw
        </Link>
      </p>
    );
  }

  const view = await loadTournamentView(tournament);

  return (
    <div className="grid gap-[var(--y-default)]">
      <RealtimeRefresh tournamentId={tournament.id} />
      <PodiumCard view={view} />

      {view.needsKnockoutDraw ? (
        <p className="border border-foreground/40 bg-mist p-5 text-base font-medium">
          The groups are finished.{" "}
          <Link href={`${base}/draw`} className="underline underline-offset-4">
            Draw the knockout
          </Link>
        </p>
      ) : null}

      {view.league ? (
        <section className="grid gap-4">
          <h2 className="text-2xl font-medium">League</h2>
          <StandingsTable view={view} table={view.league} />
        </section>
      ) : null}

      {view.groups.length > 0 ? (
        <section className="grid gap-6">
          <h2 className="text-2xl font-medium">Groups</h2>
          <div className="grid gap-10 xl:grid-cols-2">
            {view.groups.map((group) => (
              <div key={group.label} className="grid content-start gap-3">
                <h3 className="text-lg font-medium">Group {group.label}</h3>
                <StandingsTable view={view} table={group} advance={tournament.advance_per_group} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.knockout.length > 0 ? (
        <section className="grid gap-6">
          <h2 className="text-2xl font-medium">Knockout</h2>
          <Bracket view={view} hrefFor={(matchId) => `${base}/matches/${matchId}`} />
        </section>
      ) : null}
    </div>
  );
}
