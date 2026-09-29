import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CourtBoard } from "@/components/tournament/court-board";
import { MatchLists } from "@/components/tournament/match-lists";
import { PodiumCard } from "@/components/tournament/podium";
import { RealtimeRefresh } from "@/components/tournament/realtime-refresh";
import { requireUser } from "@/lib/auth/session";
import { getOrganizerTournament, loadTournamentView } from "@/lib/tournament/queries";
import { courtBoard, summarise } from "@/lib/tournament/view";
import { CourtCountForm } from "./court-count-form";

export const metadata: Metadata = {
  title: "Matches",
};

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/matches`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament } = result;
  const base = `/dashboard/tournaments/${tournament.id}`;
  const drawn = tournament.status === "in_progress" || tournament.status === "completed";

  if (!drawn) {
    return (
      <p className="max-w-2xl border border-border bg-mist p-5 text-base font-light text-foreground/70">
        There are no matches until the draw is made.{" "}
        <Link href={`${base}/draw`} className="underline underline-offset-4">
          Go to the draw
        </Link>
      </p>
    );
  }

  const view = await loadTournamentView(tournament);
  const hrefFor = (matchId: string) => `${base}/matches/${matchId}`;

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

      {tournament.status === "in_progress" ? (
        <section className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="text-2xl font-medium">Courts</h2>
            <CourtCountForm tournamentId={tournament.id} courtCount={tournament.court_count} />
          </div>
          {tournament.court_count ? (
            <CourtBoard
              actor={{ kind: "organizer", tournamentId: tournament.id }}
              courts={courtBoard(view, tournament.court_count).map(({ court, match }) => ({
                court,
                match: match ? summarise(view, match) : null,
              }))}
              upNext={view.upNext.map((match) => summarise(view, match))}
              matchHrefBase={`${base}/matches`}
            />
          ) : (
            <p className="text-base font-light text-foreground/60">
              Set the number of courts to call matches onto them. You can also score any match
              straight from the list below.
            </p>
          )}
        </section>
      ) : null}

      <MatchLists view={view} hrefFor={hrefFor} />
    </div>
  );
}
