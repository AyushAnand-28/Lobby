import type { Metadata } from "next";

import { CourtBoard } from "@/components/tournament/court-board";
import { MatchLists } from "@/components/tournament/match-lists";
import { PodiumCard } from "@/components/tournament/podium";
import { RealtimeRefresh } from "@/components/tournament/realtime-refresh";
import { getScorerSession, loadTournamentView } from "@/lib/tournament/queries";
import { courtBoard, summarise } from "@/lib/tournament/view";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const session = await getScorerSession(token);
  return { title: session ? `Scoring · ${session.name}` : "Scorer link" };
}

export default async function ScorerPage({ params }: Props) {
  const { token } = await params;
  const session = await getScorerSession(token);

  if (!session) {
    return (
      <ScorerNotice
        title="This scorer link is not valid"
        body="It may have been replaced by a newer one. Ask the organizer for the current link."
      />
    );
  }

  if (session.status !== "in_progress" && session.status !== "completed") {
    return (
      <ScorerNotice
        title={session.name}
        body="The draw hasn't been made yet. Once it is, the matches and courts appear here. Keep this page open or come back."
      >
        <RealtimeRefresh tournamentId={session.id} />
      </ScorerNotice>
    );
  }

  const view = await loadTournamentView(session);
  const base = `/s/${token}/matches`;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-[var(--y-half-default)]">
      <RealtimeRefresh tournamentId={session.id} />
      <div className="grid gap-2">
        <p className="eyebrow text-foreground/55">Scoring</p>
        <h1 className="text-[clamp(1.75rem,5vw,3rem)] leading-none font-semibold">{session.name}</h1>
      </div>

      <PodiumCard view={view} />

      {session.status === "in_progress" ? (
        <section className="grid gap-4">
          <h2 className="text-2xl font-medium">Courts</h2>
          {session.court_count ? (
            <CourtBoard
              actor={{ kind: "scorer", token }}
              courts={courtBoard(view, session.court_count).map(({ court, match }) => ({
                court,
                match: match ? summarise(view, match) : null,
              }))}
              upNext={view.upNext.map((match) => summarise(view, match))}
              matchHrefBase={base}
            />
          ) : (
            <p className="text-base font-light text-foreground/60">
              The organizer hasn&apos;t set the number of courts yet. You can still score any match
              from the list below.
            </p>
          )}
        </section>
      ) : null}

      <MatchLists view={view} hrefFor={(matchId) => `${base}/${matchId}`} />
    </div>
  );
}

function ScorerNotice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-4 border border-border bg-mist p-[var(--x-double-default)]">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="text-base leading-relaxed font-light text-foreground/70">{body}</p>
      {children}
    </div>
  );
}
