import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HeroMedia } from "@/components/motion/hero-media";
import { LiveNumber } from "@/components/motion/live-number";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";
import { Bracket } from "@/components/tournament/bracket";
import { MatchLine } from "@/components/tournament/match-line";
import { PodiumCard } from "@/components/tournament/podium";
import { RealtimeRefresh } from "@/components/tournament/realtime-refresh";
import { ScoreDigit } from "@/components/tournament/score-digit";
import { StandingsTable } from "@/components/tournament/standings-table";
import { StatusBadge } from "@/components/tournament/status-badge";
import { TOURNAMENT_ART } from "@/lib/tournament/art";
import { formatDateRange } from "@/lib/tournament/dates";
import { formatLabel } from "@/lib/tournament/format-label";
import { getPublicTournament, loadTournamentView } from "@/lib/tournament/queries";
import { matchTitle, sideName, type MatchRow, type TournamentView } from "@/lib/tournament/view";
import { getEntryKind, getScoringEngine, getSportTheme } from "@/sports/registry";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) return { title: "Tournament not found" };

  const sport = getSportTheme(tournament.sport);
  const dates = formatDateRange(tournament.starts_on, tournament.ends_on);
  return {
    title: tournament.name,
    description: [`${sport.name} tournament`, dates, tournament.venue].filter(Boolean).join(", "),
    openGraph: { images: [TOURNAMENT_ART.hero] },
  };
}

export default async function PublicTournamentPage({ params }: Props) {
  const { slug } = await params;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();

  const view = await loadTournamentView(tournament);
  const sport = getSportTheme(tournament.sport);
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const scoring = getScoringEngine(tournament.sport, tournament.settings);
  const dates = formatDateRange(tournament.starts_on, tournament.ends_on);
  const drawn = view.matches.length > 0;
  const playable = view.matches.filter((match) => match.status !== "bye").length;
  const approved = [...view.entries.values()].filter((entry) => entry.status === "approved").length;

  const facts = [dates, tournament.venue, `${sport.name} ${entryKind.label.toLowerCase()}`].filter(Boolean);

  const stats = drawn
    ? [
        { label: "Entries", value: view.entries.size },
        { label: `of ${playable} matches played`, value: view.finished.length },
        { label: "On court now", value: view.onCourt.length },
      ]
    : [
        { label: approved === 1 ? `${entryKind.noun} confirmed` : `${entryKind.noun}s confirmed`, value: approved },
        ...(tournament.max_participants ? [{ label: "places in the draw", value: tournament.max_participants }] : []),
      ];

  const sections = [
    view.onCourt.length > 0 ? { id: "live", label: "On court" } : null,
    view.knockout.length > 0 ? { id: "bracket", label: "Bracket" } : null,
    view.groups.length > 0 || view.league ? { id: "standings", label: "Standings" } : null,
    drawn && view.upNext.length + view.waiting.length > 0 ? { id: "fixtures", label: "Fixtures" } : null,
    view.finished.length > 0 ? { id: "results", label: "Results" } : null,
  ].filter((section): section is { id: string; label: string } => section !== null);

  return (
    <>
      <RealtimeRefresh tournamentId={tournament.id} />

      {/* Hero: the venue, moving, with the tournament's name over it. */}
      <section className="relative isolate flex min-h-[88svh] flex-col justify-end gutter pt-24 pb-[var(--y-half-default)]">
        <HeroMedia image={TOURNAMENT_ART.hero} video={TOURNAMENT_ART.tournamentLoop} />

        <div className="grid max-w-6xl gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tournament.status} />
            <p className="eyebrow text-foreground/70">{sport.name}</p>
          </div>
          <RevealText
            as="h1"
            split="lines"
            trigger={false}
            className="pb-1 text-[clamp(2.75rem,8vw,7.5rem)] leading-[0.95] font-semibold break-words"
          >
            {tournament.name}
          </RevealText>
          <Reveal y={20} delay={0.5} trigger={false}>
            <p className="max-w-2xl text-lg font-light text-foreground/80">{facts.join(", ")}</p>
          </Reveal>
        </div>

        <Reveal
          stagger
          y={24}
          delay={0.7}
          trigger={false}
          className="mt-[var(--y-half-default)] grid max-w-4xl grid-cols-2 gap-x-8 gap-y-6 border-t border-foreground/25 pt-6 sm:grid-cols-3"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="grid gap-1">
              <LiveNumber
                value={stat.value}
                delay={0.8}
                className="text-[clamp(2rem,5vw,3.5rem)] leading-none font-semibold"
              />
              <span className="text-sm font-light text-foreground/65">{stat.label}</span>
            </div>
          ))}
        </Reveal>
      </section>

      {sections.length > 1 ? (
        <nav
          aria-label="On this page"
          className="sticky top-0 z-20 border-y border-border bg-background/85 backdrop-blur-md"
        >
          <ul className="flex gap-6 overflow-x-auto gutter py-3" data-lenis-prevent>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm font-medium tracking-[0.08em] whitespace-nowrap text-foreground/60 uppercase underline-offset-4 hover:text-foreground hover:underline"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <PodiumCard view={view} variant="band" />

      {/* Left-aligned on the hero's gutter, so the page keeps one left edge. */}
      <div className="grid w-full max-w-[calc(72rem+2*var(--x-default))] gap-[var(--y-default)] gutter py-[var(--y-default)]">
        {tournament.description ? (
          <Reveal>
            <p className="max-w-3xl text-xl leading-relaxed font-light whitespace-pre-line text-foreground/80">
              {tournament.description}
            </p>
          </Reveal>
        ) : null}

        {!drawn ? <EntriesBeforeDraw view={view} noun={entryKind.noun} /> : null}

        {view.onCourt.length > 0 ? (
          <Section id="live" title="On court now">
            <Reveal as="ul" stagger y={24} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {view.onCourt.map((match) => (
                <li key={match.id}>
                  <LiveCourt view={view} match={match} />
                </li>
              ))}
            </Reveal>
          </Section>
        ) : null}

        {view.knockout.length > 0 ? (
          <Section id="bracket" title="Bracket">
            <Bracket view={view} />
          </Section>
        ) : null}

        {view.league || view.groups.length > 0 ? (
          <Section id="standings" title="Standings">
            {view.league ? <StandingsTable view={view} table={view.league} /> : null}
            {view.groups.length > 0 ? (
              <div className="grid gap-12 xl:grid-cols-2">
                {view.groups.map((group) => (
                  <div key={group.label} className="grid content-start gap-3">
                    <h3 className="text-xl font-medium">Group {group.label}</h3>
                    <StandingsTable view={view} table={group} advance={tournament.advance_per_group} />
                  </div>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}

        {drawn && view.upNext.length + view.waiting.length > 0 ? (
          <Section id="fixtures" title="Fixtures">
            <div className="border-t border-border">
              {[...view.upNext, ...view.waiting].map((match) => (
                <MatchLine key={match.id} view={view} match={match} />
              ))}
            </div>
          </Section>
        ) : null}

        {view.finished.length > 0 ? (
          <Section id="results" title="Results">
            <div className="border-t border-border">
              {view.finished.map((match) => (
                <MatchLine key={match.id} view={view} match={match} />
              ))}
            </div>
          </Section>
        ) : null}

        <p className="text-sm font-light text-foreground/55">
          {formatLabel(tournament)}. {scoring.summary}.
        </p>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="grid scroll-mt-16 gap-8">
      <RevealText as="h2" split="lines" className="display-lg">
        {title}
      </RevealText>
      <Reveal y={32}>
        <div className="grid gap-8">{children}</div>
      </Reveal>
    </section>
  );
}

/** A match on court, with the score of the game being played rolling in point by point. */
function LiveCourt({ view, match }: { view: TournamentView; match: MatchRow }) {
  const playing = match.status === "in_progress";
  const current = match.games[match.games.length - 1];
  const earlier = match.games.slice(0, -1);

  return (
    <div className="relative grid gap-5 overflow-clip border border-foreground/30 bg-mist p-6">
      {playing ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-flame" /> : null}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold">Court {match.court}</p>
        <p className="text-xs text-foreground/60 uppercase">{matchTitle(view, match)}</p>
      </div>
      {(["a", "b"] as const).map((side) => (
        <div key={side} className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-lg font-medium">{sideName(view, match, side)}</span>
          <span className="text-5xl leading-none font-semibold">
            {playing && current ? <ScoreDigit value={current[side]} /> : null}
          </span>
        </div>
      ))}
      <p className="text-sm font-light text-foreground/65">
        {playing
          ? earlier.length > 0
            ? `Games: ${earlier.map((game) => `${game.a}-${game.b}`).join(", ")}`
            : "Game 1"
          : "Called to court, starting soon"}
      </p>
    </div>
  );
}

function EntriesBeforeDraw({ view, noun }: { view: TournamentView; noun: string }) {
  const entries = [...view.entries.values()].filter((entry) => entry.status === "approved");

  return (
    <Section id="entries" title="Entries">
      <p className="text-base font-light text-foreground/65">
        {entries.length === 0
          ? `No ${noun}s confirmed yet. Check back once registration fills up.`
          : "The draw is made once registration closes."}
      </p>
      {entries.length > 0 ? (
        <Reveal as="ul" stagger y={20} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-1 border border-border p-5">
              <p className="text-lg font-medium">{entry.name}</p>
              {entry.players.length > 1 || entry.club ? (
                <p className="text-sm font-light text-foreground/60">
                  {[entry.players.length > 1 ? entry.players.join(" & ") : null, entry.club]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </Reveal>
      ) : null}
    </Section>
  );
}
