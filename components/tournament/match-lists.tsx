import type { TournamentView } from "@/lib/tournament/view";
import { MatchLine } from "./match-line";

/**
 * The running order: what can be played next, what is waiting on an earlier
 * result, and what has been played. Shared by the organizer and the scorer
 * link; `hrefFor` decides where a match opens.
 */
export function MatchLists({
  view,
  hrefFor,
  showFinished = true,
}: {
  view: TournamentView;
  hrefFor: (matchId: string) => string;
  showFinished?: boolean;
}) {
  return (
    <div className="grid gap-10">
      <List
        title="Up next"
        empty={view.onCourt.length > 0 ? "Everything ready is on a court." : "Nothing is ready to play."}
        view={view}
        matches={view.upNext}
        hrefFor={hrefFor}
      />
      {view.waiting.length > 0 ? (
        <List
          title="Waiting on earlier results"
          view={view}
          matches={view.waiting}
          hrefFor={hrefFor}
        />
      ) : null}
      {showFinished && view.finished.length > 0 ? (
        <List title="Played" view={view} matches={view.finished} hrefFor={hrefFor} />
      ) : null}
    </div>
  );
}

function List({
  title,
  empty,
  view,
  matches,
  hrefFor,
}: {
  title: string;
  empty?: string;
  view: TournamentView;
  matches: TournamentView["matches"];
  hrefFor: (matchId: string) => string;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-light text-foreground/55 uppercase">
        {title} · {matches.length}
      </h2>
      {matches.length === 0 ? (
        empty ? <p className="text-base font-light text-foreground/60">{empty}</p> : null
      ) : (
        <div className="border-t border-border">
          {matches.map((match) => (
            <MatchLine key={match.id} view={view} match={match} href={hrefFor(match.id)} className="px-1" />
          ))}
        </div>
      )}
    </section>
  );
}
