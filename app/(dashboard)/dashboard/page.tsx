import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon, PlusIcon } from "lucide-react";

import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";
import { StatusBadge } from "@/components/tournament/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getDisplayName, requireUser } from "@/lib/auth/session";
import { TOURNAMENT_ART, tournamentCardArt } from "@/lib/tournament/art";
import { formatDateRange } from "@/lib/tournament/dates";
import { listOrganizerTournaments, type TournamentSummary } from "@/lib/tournament/queries";
import { FORMATS } from "@/lib/tournament/types";
import { getEntryKind, getSportTheme } from "@/sports/registry";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const tournaments = await listOrganizerTournaments(user.id);
  const live = tournaments.filter((t) => t.status === "in_progress").length;
  const open = tournaments.filter((t) => t.status === "registration").length;

  const summary =
    tournaments.length === 0
      ? "Set up a draw, publish it, and share one link with every captain."
      : [
          `${tournaments.length} tournament${tournaments.length === 1 ? "" : "s"}`,
          live > 0 ? `${live} in play` : null,
          open > 0 ? `${open} taking entries` : null,
        ]
          .filter(Boolean)
          .join(", ") + ".";

  return (
    <div className="grid gap-[var(--y-default)]">
      <section className="grid items-end gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-[var(--x-double-default)]">
        <div className="grid gap-6">
          <p className="eyebrow text-foreground/55">Dashboard</p>
          <RevealText
            as="h1"
            split="lines"
            trigger={false}
            className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-semibold"
          >
            {`Hello, ${getDisplayName(user)}`}
          </RevealText>
          <Reveal y={16} delay={0.4} trigger={false}>
            <p className="max-w-md text-lg font-light text-foreground/65">{summary}</p>
          </Reveal>
          <Reveal y={16} delay={0.55} trigger={false}>
            <Link href="/dashboard/tournaments/new" className={buttonVariants({ variant: "brand", size: "xl" })}>
              <PlusIcon aria-hidden />
              New tournament
            </Link>
          </Reveal>
        </div>

        <Reveal y={32} delay={0.2} trigger={false} className="relative">
          <Parallax strength={10} className="aspect-[16/10] w-full lg:aspect-[4/3]">
            <Image
              src={tournaments.length === 0 ? TOURNAMENT_ART.empty : TOURNAMENT_ART.dashboard}
              alt={
                tournaments.length === 0
                  ? "A shuttlecock in flight against a dark background"
                  : "A badminton player mid-rally in an indoor hall"
              }
              width={1600}
              height={2260}
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="size-full object-cover"
            />
          </Parallax>
        </Reveal>
      </section>

      {tournaments.length > 0 ? (
        <section aria-label="Your tournaments" className="grid gap-6">
          <h2 className="display-lg">Your tournaments</h2>
          <Reveal as="ul" stagger y={32} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament, index) => (
              <li key={tournament.id}>
                <TournamentCard tournament={tournament} priority={index < 3} />
              </li>
            ))}
          </Reveal>
        </section>
      ) : null}
    </div>
  );
}

function TournamentCard({
  tournament,
  priority,
}: {
  tournament: TournamentSummary;
  priority: boolean;
}) {
  const sport = getSportTheme(tournament.sport);
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const dates = formatDateRange(tournament.starts_on, tournament.ends_on);
  const meta = [dates, tournament.venue].filter(Boolean).join(", ");

  return (
    <Link
      href={`/dashboard/tournaments/${tournament.id}`}
      className="group grid h-full content-start gap-5 outline-ring/50 focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[16/10] overflow-clip bg-mist">
        <Image
          src={tournamentCardArt(tournament.id)}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05] motion-reduce:transition-none"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        <ArrowUpRightIcon
          aria-hidden
          className="absolute right-4 bottom-4 size-6 text-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
      <div className="grid gap-3">
        <StatusBadge status={tournament.status} />
        <p className="text-[clamp(1.5rem,2.2vw,2rem)] leading-tight font-medium break-words">{tournament.name}</p>
        <p className="text-sm font-light text-foreground/60">
          {sport.name} {entryKind.label.toLowerCase()}, {FORMATS[tournament.format].label.toLowerCase()}
          {meta ? <span className="block">{meta}</span> : null}
        </p>
      </div>
    </Link>
  );
}
