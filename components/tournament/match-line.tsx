import Link from "next/link";

import { isDecided } from "@/lib/tournament/types";
import {
  matchTitle,
  sideName,
  winnerSide,
  type MatchRow,
  type TournamentView,
} from "@/lib/tournament/view";
import { cn } from "@/lib/utils";
import type { Side } from "@/sports/types";

/**
 * One match as a row: number and round, both sides with their game scores,
 * and where it stands. Used by every list of matches — the organizer's, the
 * scorer link's and the public page's — so a match reads the same everywhere.
 */
export function MatchLine({
  view,
  match,
  href,
  className,
}: {
  view: TournamentView;
  match: MatchRow;
  /** Makes the whole row a link, to the match's scoring screen. */
  href?: string;
  className?: string;
}) {
  const winner = winnerSide(match);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs font-medium tracking-[0.08em] text-foreground/55 uppercase">
          {match.number !== null ? `Match ${match.number} · ` : ""}
          {matchTitle(view, match)}
        </p>
        <MatchState match={match} />
      </div>
      <div className="grid gap-1.5">
        <SideRow view={view} match={match} side="a" winner={winner} />
        <SideRow view={view} match={match} side="b" winner={winner} />
      </div>
    </>
  );

  const classes = cn("grid gap-3 border-b border-border py-4", className);

  return href ? (
    <Link
      href={href}
      className={cn(classes, "outline-ring/50 transition-colors hover:bg-mist focus-visible:outline-2")}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function SideRow({
  view,
  match,
  side,
  winner,
}: {
  view: TournamentView;
  match: MatchRow;
  side: Side;
  winner: Side | null;
}) {
  const known = (side === "a" ? match.participant_a_id : match.participant_b_id) !== null;
  const won = winner === side;
  const lost = winner !== null && !won;

  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={cn(
          "min-w-0 truncate text-base",
          known ? "font-medium" : "font-light text-foreground/45 italic",
          lost && "text-foreground/50",
        )}
      >
        {sideName(view, match, side)}
        {won ? <span className="sr-only"> (winner)</span> : null}
      </span>
      <span className="flex shrink-0 gap-3 font-medium tabular-nums">
        {match.games.map((game, index) => (
          <span
            key={index}
            className={cn(
              "w-6 text-right",
              game[side] > game[side === "a" ? "b" : "a"] ? "text-foreground" : "text-foreground/45",
            )}
          >
            {game[side]}
          </span>
        ))}
      </span>
    </div>
  );
}

export function MatchState({ match }: { match: MatchRow }) {
  if (match.status === "walkover") {
    return <span className="text-xs text-foreground/55 uppercase">Walkover</span>;
  }
  if (isDecided(match.status)) {
    return <span className="text-xs text-foreground/55 uppercase">Final</span>;
  }
  if (match.status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground uppercase">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-flame" />
        Live{match.court ? ` · Court ${match.court}` : ""}
      </span>
    );
  }
  if (match.court) {
    return <span className="text-xs font-medium uppercase">Court {match.court}</span>;
  }
  return null;
}
