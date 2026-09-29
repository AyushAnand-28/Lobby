import { knockoutRoundName } from "@/lib/tournament/rounds";
import type { TournamentView } from "@/lib/tournament/view";
import { MatchLine } from "./match-line";

/**
 * The knockout, one column per round. Wider than a phone, so it scrolls
 * sideways inside its own box rather than pushing the page.
 */
export function Bracket({
  view,
  hrefFor,
}: {
  view: TournamentView;
  hrefFor?: (matchId: string) => string | undefined;
}) {
  if (view.knockout.length === 0) return null;

  return (
    <div className="grid gap-8">
      <div className="-mx-[var(--x-default)] overflow-x-auto px-[var(--x-default)] pb-2" data-lenis-prevent>
        <ol
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${view.knockout.length}, minmax(15rem, 1fr))` }}
        >
          {view.knockout.map((round, index) => (
            <li key={index} className="grid content-start gap-3">
              <h3 className="text-sm font-light text-foreground/55 uppercase">
                {knockoutRoundName(index + 1, view.totalKnockoutRounds)}
              </h3>
              {/* Spread later rounds out so each match sits between its feeders. */}
              <div className="grid h-full content-around">
                {round.map((match) =>
                  match.status === "bye" ? (
                    <div key={match.id} className="border-b border-border py-4 text-sm font-light text-foreground/45">
                      {view.entries.get(match.winner_id ?? "")?.name ?? "Bye"} · bye
                    </div>
                  ) : (
                    <MatchLine key={match.id} view={view} match={match} href={hrefFor?.(match.id)} />
                  ),
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {view.thirdPlace ? (
        <div className="grid max-w-sm gap-3">
          <h3 className="text-sm font-light text-foreground/55 uppercase">Third place</h3>
          <MatchLine view={view} match={view.thirdPlace} href={hrefFor?.(view.thirdPlace.id)} />
        </div>
      ) : null}
    </div>
  );
}
