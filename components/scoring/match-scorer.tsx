"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { ScoreDigit } from "@/components/tournament/score-digit";
import { Button } from "@/components/ui/button";
import {
  addRally,
  parseLiveState,
  replay,
  startLive,
  undoRally,
  type LiveState,
} from "@/lib/scoring/rallies";
import {
  assignCourtAction,
  saveResultAction,
  type ResultPayload,
  type ScoringActor,
} from "@/lib/tournament/scoring-actions";
import type { ScorerMatch } from "@/lib/tournament/view";
import { cn } from "@/lib/utils";
import { liveHints } from "@/sports/live";
import { getScoringEngine } from "@/sports/registry";
import type { GameScore } from "@/sports/types";

type Mode = "live" | "final";

/**
 * The scoring screen for one match. Two ways to score:
 *
 * - **Live** — tap the side that won each rally. Service, game point and the
 *   interval are shown as the umpire needs them; every tap is saved, so the
 *   public page follows along and another phone can take over.
 * - **Final score** — type each game's score after the match.
 *
 * Both go through the same server checks: a result must be a legal score under
 * this tournament's rules, and the winner is read from the score.
 */
export function MatchScorer({
  actor,
  match,
  sport,
  settings,
  courtCount,
  busyCourts,
  backHref,
  canScore,
  blockedReason,
}: {
  actor: ScoringActor;
  match: ScorerMatch;
  sport: string;
  settings: unknown;
  courtCount: number | null;
  /** Courts holding another match. */
  busyCourts: string[];
  backHref: string;
  canScore: boolean;
  blockedReason?: string;
}) {
  const engine = useMemo(() => getScoringEngine(sport, settings), [sport, settings]);
  const decided = match.status === "completed" || match.status === "walkover";
  const hasLive = parseLiveState(match.live) !== null;
  const [mode, setMode] = useState<Mode>(hasLive && !decided ? "live" : "final");

  return (
    <div className="grid gap-8">
      <CourtPicker
        actor={actor}
        match={match}
        courtCount={courtCount}
        busyCourts={busyCourts}
        disabled={!canScore || decided}
      />

      <p className="text-sm font-light text-foreground/60">{engine.summary}.</p>

      {!canScore ? (
        <p className="border border-border bg-mist p-5 text-base font-light text-foreground/70">
          {blockedReason ?? "This match can't be scored yet."}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Scoring mode" className="flex border-b border-border">
            {(
              [
                ["live", "Live"],
                ["final", decided ? "Result" : "Final score"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "-mb-px border-b-2 px-4 py-3 text-sm font-medium tracking-[0.08em] uppercase",
                  mode === value ? "border-foreground text-foreground" : "border-transparent text-foreground/50",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "live" ? (
            <LiveScorer
              actor={actor}
              match={match}
              sport={sport}
              settings={settings}
              engine={engine}
              backHref={backHref}
              decided={decided}
            />
          ) : (
            <FinalScoreForm actor={actor} match={match} engine={engine} backHref={backHref} decided={decided} />
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Court
// -----------------------------------------------------------------------------

function CourtPicker({
  actor,
  match,
  courtCount,
  busyCourts,
  disabled,
}: {
  actor: ScoringActor;
  match: ScorerMatch;
  courtCount: number | null;
  busyCourts: string[];
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!courtCount) return null;

  return (
    <div className="grid gap-2">
      <label htmlFor="court" className="text-sm font-light text-foreground/60 uppercase">
        Court
      </label>
      <select
        id="court"
        value={match.court ?? ""}
        disabled={disabled || pending}
        onChange={(event) => {
          const court = event.target.value || null;
          setError(null);
          startTransition(async () => {
            const result = await assignCourtAction(actor, match.id, court);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
        className="h-12 w-full max-w-xs border border-border bg-background px-3 text-base disabled:opacity-50"
      >
        <option value="">Not on a court</option>
        {Array.from({ length: courtCount }, (_, index) => String(index + 1)).map((court) => (
          <option key={court} value={court} disabled={busyCourts.includes(court)}>
            Court {court}
            {busyCourts.includes(court) ? " (in use)" : ""}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Live
// -----------------------------------------------------------------------------

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

function LiveScorer({
  actor,
  match,
  sport,
  settings,
  engine,
  backHref,
  decided,
}: {
  actor: ScoringActor;
  match: ScorerMatch;
  sport: string;
  settings: unknown;
  engine: ReturnType<typeof getScoringEngine>;
  backHref: string;
  decided: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<LiveState | null>(() => parseLiveState(match.live));
  const [previous, setPrevious] = useState<LiveState | null>(null);
  const [save, setSave] = useState<SaveStatus>({ kind: "idle" });
  const [finishing, setFinishing] = useState(false);

  // Taps can outrun the network. Each save sends the whole log, so only the
  // newest state matters: one request in flight, and one more afterwards if
  // anything changed while it was out.
  const latest = useRef<LiveState | null>(state);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const dirty = useRef(false);

  function flush(): Promise<boolean> {
    if (inFlight.current) {
      dirty.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      setSave({ kind: "saving" });
      do {
        dirty.current = false;
        const result = await saveResultAction(actor, match.id, {
          kind: "live",
          live: latest.current,
          finish: false,
        });
        if (result.error) {
          setSave({ kind: "error", message: result.error });
          return false;
        }
      } while (dirty.current);
      setSave({ kind: "saved" });
      return true;
    })();
    inFlight.current = run;
    void run.finally(() => {
      inFlight.current = null;
    });
    return run;
  }

  function update(next: LiveState) {
    setPrevious(state);
    setState(next);
    latest.current = next;
    void flush();
  }

  if (decided) {
    return (
      <p className="text-base font-light text-foreground/70">
        This match has a result. To change it, use the Result tab.
      </p>
    );
  }

  if (!state) {
    return (
      <div className="grid gap-4">
        <p className="text-base font-light text-foreground/70">Who serves first?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["a", "b"] as const).map((side) => (
            <Button
              key={side}
              type="button"
              variant="outline"
              size="xl"
              className="h-auto min-h-16 justify-start px-5 py-4 text-left normal-case tracking-normal"
              onClick={() => update(startLive(side))}
            >
              <span className="truncate text-lg font-medium">{side === "a" ? match.a : match.b}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const snapshot = replay(engine, state);
  const before = previous ? replay(engine, previous) : null;
  const hints = liveHints(sport, settings, engine, snapshot, before);
  const winnerName = snapshot.winner === "a" ? match.a : snapshot.winner === "b" ? match.b : null;
  const finishedGames = snapshot.winner ? snapshot.games : snapshot.games.slice(0, snapshot.currentIndex);

  async function finish() {
    setFinishing(true);
    const flushed = await flush();
    if (!flushed) {
      setFinishing(false);
      return;
    }
    const result = await saveResultAction(actor, match.id, {
      kind: "live",
      live: latest.current,
      finish: true,
    });
    if (result.error) {
      setSave({ kind: "error", message: result.error });
      setFinishing(false);
      return;
    }
    router.push(backHref);
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm font-light text-foreground/60">
        Game {snapshot.currentIndex + 1}
        {finishedGames.length > 0
          ? ` · Games: ${finishedGames.map((game) => `${game.a}-${game.b}`).join(", ")}`
          : ""}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {(["a", "b"] as const).map((side) => {
          const serving = snapshot.server === side;
          const point = hints.matchPoint === side ? "Match point" : hints.gamePoint === side ? "Game point" : null;
          return (
            <button
              key={side}
              type="button"
              disabled={snapshot.winner !== null || finishing}
              onClick={() => update(addRally(engine, state, side))}
              aria-label={`Rally to ${side === "a" ? match.a : match.b}`}
              className={cn(
                "grid min-h-56 content-between gap-4 border p-4 text-left transition-[background-color,color,transform] duration-150 select-none active:scale-[0.985] active:bg-foreground active:text-background disabled:opacity-60 motion-reduce:active:scale-100 sm:min-h-72 sm:p-6",
                serving ? "border-foreground bg-mist" : "border-border",
              )}
            >
              <span className="grid gap-1">
                <span className="line-clamp-2 text-base font-medium break-words sm:text-lg">
                  {side === "a" ? match.a : match.b}
                </span>
                <span className="text-xs font-medium tracking-[0.08em] text-foreground/60 uppercase">
                  Games {snapshot.gamesWon[side]}
                </span>
              </span>
              <span className="text-[clamp(4rem,18vw,9rem)] leading-none font-semibold">
                <ScoreDigit value={snapshot.current[side]} />
              </span>
              <span className="grid min-h-10 gap-1 text-xs font-medium tracking-[0.08em] uppercase">
                {serving ? (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full bg-flame" />
                    Serving{hints.serviceCourt ? ` · ${hints.serviceCourt} court` : ""}
                  </span>
                ) : null}
                {point ? <span className="text-flame">{point}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {hints.interval ? (
        <p aria-live="polite" className="border border-border p-4 text-base font-medium">
          Interval: up to 60 seconds.{hints.changeEnds ? " Change ends." : ""}
        </p>
      ) : null}

      {snapshot.winner ? (
        <div className="grid gap-4 border border-foreground/40 bg-mist p-5">
          <p className="text-xl font-medium">
            {winnerName} wins {snapshot.gamesWon[snapshot.winner]}-{snapshot.gamesWon[snapshot.winner === "a" ? "b" : "a"]}
          </p>
          <Button type="button" variant="brand" size="xl" disabled={finishing} onClick={finish}>
            {finishing ? "Saving…" : "Confirm result"}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="px-5"
          disabled={state.rallies.length === 0 || finishing}
          onClick={() => update(undoRally(state))}
        >
          Undo last rally
        </Button>
        <SaveIndicator status={save} onRetry={() => void flush()} />
      </div>
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status.kind === "error") {
    return (
      <span className="flex flex-wrap items-center gap-3 text-sm font-medium text-destructive" aria-live="polite">
        Not saved: {status.message}
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </span>
    );
  }
  return (
    <span className="text-sm font-light text-foreground/55" aria-live="polite">
      {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? "Saved" : ""}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Final score
// -----------------------------------------------------------------------------

type GameInput = { a: string; b: string };

function toInputs(games: GameScore[], count: number): GameInput[] {
  return Array.from({ length: count }, (_, index) => ({
    a: games[index] ? String(games[index].a) : "",
    b: games[index] ? String(games[index].b) : "",
  }));
}

/** The games typed so far, stopping at the first empty row. */
function readGames(inputs: GameInput[]): GameScore[] | null {
  const games: GameScore[] = [];
  for (const input of inputs) {
    if (input.a.trim() === "" && input.b.trim() === "") break;
    const a = Number(input.a);
    const b = Number(input.b);
    if (input.a.trim() === "" || input.b.trim() === "" || !Number.isInteger(a) || !Number.isInteger(b)) {
      return null;
    }
    games.push({ a, b });
  }
  return games;
}

function FinalScoreForm({
  actor,
  match,
  engine,
  backHref,
  decided,
}: {
  actor: ScoringActor;
  match: ScorerMatch;
  engine: ReturnType<typeof getScoringEngine>;
  backHref: string;
  decided: boolean;
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<GameInput[]>(() => toInputs(match.games, engine.maxGames));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const games = readGames(inputs);
  const check = games && games.length > 0 ? engine.check(games, { final: true }) : null;
  const preview = check?.ok && check.progress.winner ? (check.progress.winner === "a" ? match.a : match.b) : null;

  function submit(payload: ResultPayload, then: "back" | "stay") {
    setError(null);
    startTransition(async () => {
      const result = await saveResultAction(actor, match.id, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (then === "back") router.push(backHref);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {decided ? (
        <p className="text-base font-light text-foreground/70">
          {match.status === "walkover" ? "Recorded as a walkover" : "Result recorded"}
          {match.winner ? `: ${match.winner === "a" ? match.a : match.b} won` : ""}. Change the
          scores below to correct it.
        </p>
      ) : null}

      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!games) {
            setError("Enter both scores for every game played.");
            return;
          }
          submit({ kind: "final", games }, "back");
        }}
      >
        <table className="w-full max-w-md border-collapse">
          <thead>
            <tr className="text-xs font-light tracking-[0.06em] text-foreground/55 uppercase">
              <th scope="col" className="w-20 py-2 text-left font-light">Game</th>
              <th scope="col" className="py-2 text-left font-light">
                <span className="line-clamp-1">{match.a}</span>
              </th>
              <th scope="col" className="py-2 text-left font-light">
                <span className="line-clamp-1">{match.b}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((input, index) => (
              <tr key={index}>
                <th scope="row" className="py-1.5 text-left text-sm font-light text-foreground/60">
                  {index + 1}
                </th>
                {(["a", "b"] as const).map((side) => (
                  <td key={side} className="py-1.5 pr-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      aria-label={`Game ${index + 1}, ${side === "a" ? match.a : match.b}`}
                      value={input[side]}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, "");
                        setInputs((current) =>
                          current.map((row, i) => (i === index ? { ...row, [side]: value } : row)),
                        );
                      }}
                      className="h-14 w-full border border-border bg-transparent text-center text-2xl font-medium tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="min-h-6 text-sm" aria-live="polite">
          {preview ? (
            <span className="font-medium">Winner: {preview}</span>
          ) : check && !check.ok ? (
            <span className="text-foreground/60">{check.message}</span>
          ) : null}
        </p>

        <Button type="submit" variant="brand" size="xl" disabled={pending || !check?.ok}>
          {pending ? "Saving…" : decided ? "Save correction" : "Save result"}
        </Button>
      </form>

      <details className="border-t border-border pt-5">
        <summary className="cursor-pointer text-sm font-medium tracking-[0.08em] uppercase">
          Walkover or retirement
        </summary>
        <div className="mt-4 grid gap-3">
          <p className="text-sm font-light text-foreground/60">
            When one side doesn&apos;t turn up or can&apos;t finish. Any games typed above are kept as
            played. Who goes through?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <Button
                key={side}
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                className="h-auto min-h-12 justify-start px-4 py-3 text-left whitespace-normal"
                onClick={() => submit({ kind: "walkover", winner: side, games: games ?? [] }, "back")}
              >
                {side === "a" ? match.a : match.b}
              </Button>
            ))}
          </div>
        </div>
      </details>

      {decided || match.status === "in_progress" ? (
        <div className="border-t border-border pt-5">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={() => {
              setInputs(toInputs([], engine.maxGames));
              submit({ kind: "clear" }, "stay");
            }}
          >
            Clear the score
          </Button>
          <p className="mt-2 text-sm font-light text-foreground/55">
            Sets the match back to not played, live scoring included.
          </p>
        </div>
      ) : null}

      {error ? (
        <p aria-live="polite" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
