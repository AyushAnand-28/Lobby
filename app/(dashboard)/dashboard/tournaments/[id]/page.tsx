import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/auth/submit-button";
import { LiveNumber } from "@/components/motion/live-number";
import { CopyLink } from "@/components/tournament/copy-link";
import { PodiumCard } from "@/components/tournament/podium";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import {
  publishTournamentAction,
  rotateRegistrationLinkAction,
  rotateScorerLinkAction,
  setRegistrationOpenAction,
} from "@/lib/tournament/actions";
import { formatDateRange } from "@/lib/tournament/dates";
import {
  getOrganizerTournament,
  getScorerToken,
  loadTournamentView,
  type TournamentDetail,
} from "@/lib/tournament/queries";
import {
  REGISTRATION_BLOCK_ORGANIZER_COPY,
  registrationBlockReason,
} from "@/lib/tournament/registration";
import { formatLabel } from "@/lib/tournament/format-label";
import { getEntryKind, getScoringEngine, getSportTheme } from "@/sports/registry";

export const metadata: Metadata = {
  title: "Tournament",
};

export default async function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament, token, counts } = result;
  const base = `/dashboard/tournaments/${tournament.id}`;
  const drawn = tournament.status === "in_progress" || tournament.status === "completed";
  const published = tournament.status !== "draft";
  const [view, scorerToken] = await Promise.all([
    drawn ? loadTournamentView(tournament) : null,
    published ? getScorerToken(tournament.id) : null,
  ]);

  return (
    <div className="grid gap-[var(--y-default)]">
      <div className="grid gap-[var(--y-half-default)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-[var(--x-double-default)]">
        <div className="grid content-start gap-[var(--y-half-default)]">
          {view ? <PodiumCard view={view} /> : null}

          {tournament.status === "draft" ? (
            <Panel title="Publish">
              <p className="max-w-lg text-base leading-relaxed font-light text-foreground/70">
                This tournament is a draft, so only you can see it. Publish it to get the link
                captains use to enter, and the public page for players and spectators.
              </p>
              <form action={publishTournamentAction.bind(null, tournament.id)} className="max-w-xs">
                <SubmitButton pendingLabel="Publishing…">Publish</SubmitButton>
              </form>
            </Panel>
          ) : null}

          {tournament.status === "registration" ? (
            <RegistrationPanel tournament={tournament} token={token} live={counts.pending + counts.approved} />
          ) : null}

          {view ? (
            <Panel title={tournament.status === "completed" ? "Finished" : "In play"}>
              <Progress
                played={view.finished.length}
                total={view.matches.filter((match) => match.status !== "bye").length}
                onCourt={view.onCourt.length}
                live={view.matches.filter((match) => match.status === "in_progress").length}
              />
              {view.needsKnockoutDraw ? (
                <p className="text-base font-medium">
                  Every group match is played. Draw the knockout from the standings.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Link href={`${base}/matches`} className={buttonVariants({ variant: "brand", size: "xl" })}>
                  Matches & courts
                </Link>
                <Link href={`${base}/standings`} className={buttonVariants({ variant: "outline", size: "xl" })}>
                  Standings
                </Link>
              </div>
            </Panel>
          ) : null}

          <Panel title="Entries">
            <dl className="grid grid-cols-3 gap-4">
              <Count label="Waiting" value={counts.pending} />
              <Count label="Approved" value={counts.approved} />
              <Count label="Rejected" value={counts.rejected + counts.withdrawn} />
            </dl>
            <div className="flex flex-wrap gap-3">
              <Link href={`${base}/entries`} className={buttonVariants({ variant: "outline", size: "lg", className: "px-4" })}>
                {counts.pending > 0 ? "Review entries" : "See entries"}
              </Link>
              {tournament.status === "registration" ? (
                <Link href={`${base}/draw`} className={buttonVariants({ variant: "outline", size: "lg", className: "px-4" })}>
                  Make the draw
                </Link>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-[var(--y-half-default)]">
          {published ? (
            <Panel title="Public page">
              <p className="text-base leading-relaxed font-light text-foreground/70">
                Fixtures, live scores, standings and the bracket. Share it with players and
                spectators. No login needed, and it updates as results come in.
              </p>
              <CopyLink url={`${getSiteUrl()}/t/${tournament.slug}`} />
              <Link
                href={`/t/${tournament.slug}`}
                target="_blank"
                className={buttonVariants({ variant: "outline", size: "sm", className: "justify-self-start" })}
              >
                Open public page
              </Link>
            </Panel>
          ) : null}

          {published && scorerToken ? (
            <Panel title="Scorer link">
              <p className="text-base leading-relaxed font-light text-foreground/70">
                For volunteers at the courts. Anyone with it can call matches to courts and enter
                scores, and nothing else. They don&apos;t see entries&apos; phone numbers.
              </p>
              <CopyLink url={`${getSiteUrl()}/s/${scorerToken}`} />
              <form action={rotateScorerLinkAction.bind(null, tournament.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Replace scorer link
                </Button>
              </form>
            </Panel>
          ) : null}

          <Details tournament={tournament} />
        </div>
      </div>
    </div>
  );
}

function RegistrationPanel({
  tournament,
  token,
  live,
}: {
  tournament: TournamentDetail;
  token: string | null;
  live: number;
}) {
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const block = registrationBlockReason(tournament, live);
  const registrationUrl = token ? `${getSiteUrl()}/r/${token}` : null;

  return (
    <Panel title="Registration">
      <p className="max-w-lg text-base leading-relaxed font-light text-foreground/70">
        {block
          ? REGISTRATION_BLOCK_ORGANIZER_COPY[block]
          : `Share this link in your group. Anyone with it can enter a ${entryKind.noun}; entries wait for your approval.`}
      </p>

      {registrationUrl ? <CopyLink url={registrationUrl} /> : null}

      <div className="flex flex-wrap gap-3">
        {registrationUrl ? (
          <Link
            href={`/r/${token}`}
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open as a captain
          </Link>
        ) : null}
        <form action={setRegistrationOpenAction.bind(null, tournament.id, !tournament.registration_open)}>
          <Button type="submit" variant="outline" size="sm">
            {tournament.registration_open ? "Pause registration" : "Resume registration"}
          </Button>
        </form>
        <form action={rotateRegistrationLinkAction.bind(null, tournament.id)}>
          <Button type="submit" variant="outline" size="sm">
            Replace link
          </Button>
        </form>
      </div>
      <p className="text-sm font-light text-muted-foreground">
        Replacing the link stops the old one working. Use it if the link was shared somewhere it
        should not have been.
      </p>
    </Panel>
  );
}

function Progress({
  played,
  total,
  onCourt,
  live,
}: {
  played: number;
  total: number;
  onCourt: number;
  live: number;
}) {
  const percent = total > 0 ? Math.round((played / total) * 100) : 0;
  return (
    <div className="grid gap-3">
      <p className="text-3xl font-medium tabular-nums">
        <LiveNumber value={played} /> <span className="text-foreground/50">of {total} matches played</span>
      </p>
      <div className="h-1.5 w-full bg-border" aria-hidden>
        <div className="h-full bg-foreground" style={{ width: `${percent}%` }} />
      </div>
      {played < total ? (
        <p className="text-sm font-light text-foreground/60">
          {onCourt} on court · {live} being scored live
        </p>
      ) : null}
    </div>
  );
}

function Details({ tournament }: { tournament: TournamentDetail }) {
  const sport = getSportTheme(tournament.sport);
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const scoring = getScoringEngine(tournament.sport, tournament.settings);
  const dates = formatDateRange(tournament.starts_on, tournament.ends_on);

  const facts = [
    { label: "Event", value: `${sport.name} ${entryKind.label.toLowerCase()}` },
    { label: "Format", value: formatLabel(tournament) },
    { label: "Scoring", value: scoring.summary },
    { label: "Dates", value: dates ?? "Not set" },
    { label: "Venue", value: tournament.venue ?? "Not set" },
    { label: "Courts", value: tournament.court_count ? String(tournament.court_count) : "Not set" },
    {
      label: "Maximum entries",
      value: tournament.max_participants ? String(tournament.max_participants) : "No limit",
    },
  ];

  return (
    <section aria-labelledby="details-heading" className="grid content-start gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="details-heading" className="text-2xl font-medium">
          Details
        </h2>
        <Link
          href={`/dashboard/tournaments/${tournament.id}/edit`}
          className="text-sm font-light text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          Edit
        </Link>
      </div>
      <dl className="grid gap-5">
        {facts.map((fact) => (
          <div key={fact.label} className="grid gap-1 border-b border-border pb-4">
            <dt className="text-sm font-light text-foreground/55 uppercase">{fact.label}</dt>
            <dd className="text-base">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {tournament.description ? (
        <p className="text-base leading-relaxed font-light whitespace-pre-line text-foreground/70">
          {tournament.description}
        </p>
      ) : null}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-6 border border-border bg-mist p-[var(--x-double-default)]">
      <h2 className="text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm font-light text-foreground/55">{label}</dt>
      <dd className="text-3xl font-medium tabular-nums">{value}</dd>
    </div>
  );
}
