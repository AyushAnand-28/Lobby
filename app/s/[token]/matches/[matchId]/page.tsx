import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchScorer } from "@/components/scoring/match-scorer";
import { getScorerSession, loadTournamentView } from "@/lib/tournament/queries";
import { scorerMatchProps } from "@/lib/tournament/scorer-props";

export const metadata: Metadata = {
  title: "Score",
};

export default async function ScorerMatchPage({
  params,
}: {
  params: Promise<{ token: string; matchId: string }>;
}) {
  const { token, matchId } = await params;
  const session = await getScorerSession(token);
  if (!session || (session.status !== "in_progress" && session.status !== "completed")) notFound();

  const view = await loadTournamentView(session);
  const props = scorerMatchProps(view, session, matchId);
  if (!props) notFound();

  const backHref = `/s/${token}`;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <div className="grid gap-3">
        <Link
          href={backHref}
          className="text-sm font-light text-foreground/55 underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Courts and matches
        </Link>
        <p className="eyebrow text-foreground/55">{props.heading}</p>
        <h1 className="text-[clamp(1.5rem,4vw,2.5rem)] leading-tight font-semibold">
          {props.match.a} <span className="font-light text-foreground/50">v</span> {props.match.b}
        </h1>
      </div>
      <MatchScorer
        actor={{ kind: "scorer", token }}
        match={props.match}
        sport={session.sport}
        settings={session.settings}
        courtCount={session.court_count}
        busyCourts={props.busyCourts}
        backHref={backHref}
        canScore={props.canScore}
        blockedReason={props.blockedReason}
      />
    </div>
  );
}
