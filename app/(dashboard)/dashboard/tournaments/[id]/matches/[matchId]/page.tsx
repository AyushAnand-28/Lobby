import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchScorer } from "@/components/scoring/match-scorer";
import { requireUser } from "@/lib/auth/session";
import { getOrganizerTournament, loadTournamentView } from "@/lib/tournament/queries";
import { scorerMatchProps } from "@/lib/tournament/scorer-props";

export const metadata: Metadata = {
  title: "Score",
};

export default async function OrganizerMatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/matches/${matchId}`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament } = result;
  const view = await loadTournamentView(tournament);
  const props = scorerMatchProps(view, tournament, matchId);
  if (!props) notFound();

  const backHref = `/dashboard/tournaments/${tournament.id}/matches`;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <div className="grid gap-3">
        <Link
          href={backHref}
          className="text-sm font-light text-foreground/55 underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Matches
        </Link>
        <p className="eyebrow text-foreground/55">{props.heading}</p>
        <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] leading-tight font-semibold">
          {props.match.a} <span className="font-light text-foreground/50">v</span> {props.match.b}
        </h2>
      </div>
      <MatchScorer
        actor={{ kind: "organizer", tournamentId: tournament.id }}
        match={props.match}
        sport={tournament.sport}
        settings={tournament.settings}
        courtCount={tournament.court_count}
        busyCourts={props.busyCourts}
        backHref={backHref}
        canScore={props.canScore}
        blockedReason={props.blockedReason}
      />
    </div>
  );
}
