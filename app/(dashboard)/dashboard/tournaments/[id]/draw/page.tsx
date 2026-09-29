import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/forms/action-form";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { Bracket } from "@/components/tournament/bracket";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import {
  drawKnockoutAction,
  makeDrawAction,
  resetDrawAction,
  resetKnockoutAction,
} from "@/lib/tournament/draw-actions";
import { describeDraw } from "@/lib/tournament/draw-preview";
import { formatLabel } from "@/lib/tournament/format-label";
import { getOrganizerTournament, loadTournamentView } from "@/lib/tournament/queries";
import { isDecided } from "@/lib/tournament/types";

export const metadata: Metadata = {
  title: "Draw",
};

const ORDER_CHOICES = [
  {
    value: "random",
    label: "Random draw",
    detail: "Seeds are placed first; everyone else is drawn at random around them.",
  },
  {
    value: "registration",
    label: "Registration order",
    detail: "Unseeded entries go in the order they entered. Predictable, and easy to explain.",
  },
] as const;

export default async function DrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/draw`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament, counts } = result;
  const base = `/dashboard/tournaments/${tournament.id}`;
  const drawn = tournament.status === "in_progress" || tournament.status === "completed";

  if (tournament.status === "draft") {
    return (
      <Notice>
        Publish the tournament and approve entries first. The draw is made from approved
        entries only.
      </Notice>
    );
  }

  if (!drawn) {
    const preview = describeDraw({
      format: tournament.format,
      entries: counts.approved,
      groupCount: tournament.group_count,
      advancePerGroup: tournament.advance_per_group,
      thirdPlace: tournament.third_place_match,
    });

    return (
      <div className="grid max-w-2xl gap-10">
        <section className="grid gap-4">
          <h2 className="text-2xl font-medium">Make the draw</h2>
          <p className="text-base font-light text-foreground/70">
            {formatLabel(tournament)} · {counts.approved} approved{" "}
            {counts.approved === 1 ? "entry" : "entries"}
          </p>
          {preview.lines.length > 0 ? (
            <ul className="grid gap-1 text-base">
              {preview.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {preview.problem ? <Notice>{preview.problem}</Notice> : null}
          {counts.pending > 0 ? (
            <p className="text-base font-medium">
              {counts.pending} {counts.pending === 1 ? "entry is" : "entries are"} still waiting
              for approval and won&apos;t be in the draw.{" "}
              <Link href={`${base}/entries`} className="font-light underline underline-offset-4">
                Review entries
              </Link>
            </p>
          ) : null}
        </section>

        {!preview.problem ? (
          <ActionForm
            action={makeDrawAction.bind(null, tournament.id)}
            label="Make the draw"
            pendingLabel="Drawing…"
          >
            <ChoiceGroup name="order" legend="Draw order" choices={ORDER_CHOICES} columns={2} defaultValue="random" />
            <p className="text-sm font-light text-foreground/60">
              Making the draw closes registration. You can redraw or reset it until the first
              match is played.
            </p>
          </ActionForm>
        ) : null}
      </div>
    );
  }

  const view = await loadTournamentView(tournament);
  const played = view.matches.some(
    (match) => match.status === "in_progress" || (isDecided(match.status) && match.status !== "bye"),
  );
  const knockoutPlayed = [...view.knockout.flat(), ...(view.thirdPlace ? [view.thirdPlace] : [])].some(
    (match) => match.status === "in_progress" || (isDecided(match.status) && match.status !== "bye"),
  );

  return (
    <div className="grid gap-[var(--y-default)]">
      {view.groups.length > 0 ? (
        <section className="grid gap-6">
          <h2 className="text-2xl font-medium">Groups</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {view.groups.map((group) => (
              <li key={group.label} className="grid content-start gap-3 border border-border p-5">
                <h3 className="text-lg font-medium">Group {group.label}</h3>
                <ol className="grid gap-1.5">
                  {group.rows
                    .slice()
                    .sort((x, y) => (view.entries.get(x.participantId)?.seed ?? 999) - (view.entries.get(y.participantId)?.seed ?? 999))
                    .map((row) => {
                      const entry = view.entries.get(row.participantId);
                      return (
                        <li key={row.participantId} className="text-base">
                          {entry?.name}
                          {entry?.seed ? <span className="ml-2 text-xs text-foreground/55">seed {entry.seed}</span> : null}
                        </li>
                      );
                    })}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.league ? (
        <section className="grid gap-3">
          <h2 className="text-2xl font-medium">League</h2>
          <p className="text-base font-light text-foreground/70">
            {view.league.rows.length} entries, {view.league.matches.length} matches. The order of
            play is on the Matches tab.
          </p>
        </section>
      ) : null}

      {view.knockout.length > 0 ? (
        <section className="grid gap-6">
          <h2 className="text-2xl font-medium">Knockout</h2>
          <Bracket view={view} hrefFor={(matchId) => `${base}/matches/${matchId}`} />
        </section>
      ) : null}

      {tournament.format === "groups_knockout" ? (
        <section className="grid max-w-2xl gap-4 border border-border p-[var(--x-double-default)]">
          <h2 className="text-2xl font-medium">Knockout draw</h2>
          {view.knockoutDrawn ? (
            <>
              <p className="text-base font-light text-foreground/70">
                Drawn from the final group tables. Group results are locked while it exists.
              </p>
              {!knockoutPlayed ? (
                <ActionForm
                  action={resetKnockoutAction.bind(null, tournament.id)}
                  label="Remove the knockout"
                  pendingLabel="Removing…"
                  variant="secondary"
                  confirm="Remove the knockout? You can draw it again after correcting group results."
                />
              ) : null}
            </>
          ) : view.needsKnockoutDraw ? (
            <>
              <p className="text-base font-light text-foreground/70">
                Every group match is played. The top {tournament.advance_per_group} of each group go
                through; group winners are seeded, and entries from the same group are kept apart.
              </p>
              <ActionForm
                action={drawKnockoutAction.bind(null, tournament.id)}
                label="Draw the knockout"
                pendingLabel="Drawing…"
              />
            </>
          ) : (
            <p className="text-base font-light text-foreground/70">
              Once every group match has a result, draw it here from the final tables.
            </p>
          )}
        </section>
      ) : null}

      <section className="grid max-w-2xl gap-4 border-t border-border pt-8">
        <h2 className="text-2xl font-medium">Change the draw</h2>
        {played ? (
          <p className="text-base font-light text-foreground/70">
            Matches have been played, so the draw is fixed. Scores can still be corrected on the
            Matches tab.
          </p>
        ) : (
          <>
            <p className="text-base font-light text-foreground/70">
              Nothing has been played yet, so you can still redraw, or reset to change entries and
              seeds.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <ActionForm
                action={makeDrawAction.bind(null, tournament.id)}
                label="Redraw at random"
                pendingLabel="Drawing…"
                variant="secondary"
                confirm="Redraw? The current draw is replaced."
              >
                <input type="hidden" name="order" value="random" />
              </ActionForm>
              <ActionForm
                action={resetDrawAction.bind(null, tournament.id)}
                label="Reset the draw"
                pendingLabel="Resetting…"
                variant="secondary"
                confirm="Reset the draw? All fixtures are removed and entries can change again."
              />
            </div>
          </>
        )}
        <Link href={`${base}/matches`} className={buttonVariants({ variant: "brand", size: "xl", className: "justify-self-start" })}>
          Go to matches
        </Link>
      </section>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-2xl border border-border bg-mist p-5 text-base font-light text-foreground/70">
      {children}
    </p>
  );
}
