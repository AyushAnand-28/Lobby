"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { assignCourtAction, type ScoringActor } from "@/lib/tournament/scoring-actions";
import type { MatchSummary } from "@/lib/tournament/view";
import { cn } from "@/lib/utils";

/**
 * The venue at a glance: every court, what is on it, and a way to call the
 * next match to a free one. The organizer and the scorer link share it.
 */
export function CourtBoard({
  actor,
  courts,
  upNext,
  matchHrefBase,
}: {
  actor: ScoringActor;
  courts: { court: string; match: MatchSummary | null }[];
  upNext: MatchSummary[];
  /** `${matchHrefBase}/${matchId}` is a match's scoring screen. */
  matchHrefBase: string;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {courts.map(({ court, match }) => (
        <li key={court}>
          <CourtCard
            actor={actor}
            court={court}
            match={match}
            upNext={upNext}
            matchHrefBase={matchHrefBase}
          />
        </li>
      ))}
    </ul>
  );
}

function CourtCard({
  actor,
  court,
  match,
  upNext,
  matchHrefBase,
}: {
  actor: ScoringActor;
  court: string;
  match: MatchSummary | null;
  upNext: MatchSummary[];
  matchHrefBase: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>("");
  const selected = choice || upNext[0]?.id || "";

  function assign(matchId: string, target: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await assignCourtAction(actor, matchId, target);
      if (result.error) setError(result.error);
      else setChoice("");
    });
  }

  return (
    <div
      className={cn(
        "grid h-full content-start gap-4 border p-5",
        match ? "border-foreground/40 bg-mist" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">Court {court}</h3>
        <span className="text-xs font-medium tracking-[0.08em] text-foreground/55 uppercase">
          {match ? (match.status === "in_progress" ? "Playing" : "Called") : "Free"}
        </span>
      </div>

      {match ? (
        <>
          <div className="grid gap-1">
            <p className="text-xs text-foreground/55 uppercase">
              {match.number !== null ? `Match ${match.number} · ` : ""}
              {match.title}
            </p>
            <p className="text-base font-medium">{match.a}</p>
            <p className="text-base font-medium">{match.b}</p>
            {match.games.length > 0 ? (
              <p className="text-sm text-foreground/70 tabular-nums">
                {match.games.map((game) => `${game.a}-${game.b}`).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${matchHrefBase}/${match.id}`}
              className={buttonVariants({ variant: "brand", size: "lg", className: "px-4" })}
            >
              Score
            </Link>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-4"
              disabled={pending}
              onClick={() => assign(match.id, null)}
            >
              Take off court
            </Button>
          </div>
        </>
      ) : upNext.length > 0 ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) assign(selected, court);
          }}
        >
          <label htmlFor={`call-${court}`} className="text-sm font-light text-foreground/60">
            Call a match to this court
          </label>
          <select
            id={`call-${court}`}
            value={selected}
            onChange={(event) => setChoice(event.target.value)}
            className="h-11 w-full border border-border bg-background px-3 text-base"
          >
            {upNext.map((option) => (
              <option key={option.id} value={option.id}>
                {option.number !== null ? `${option.number}. ` : ""}
                {option.a} v {option.b}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="lg" disabled={pending || !selected}>
            {pending ? "Calling…" : "Call to court"}
          </Button>
        </form>
      ) : (
        <p className="text-sm font-light text-foreground/55">No match is ready to call.</p>
      )}

      {error ? (
        <p aria-live="polite" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
