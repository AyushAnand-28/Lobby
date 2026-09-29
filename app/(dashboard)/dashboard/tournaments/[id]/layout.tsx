import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RevealText } from "@/components/motion/reveal-text";
import { StatusBadge } from "@/components/tournament/status-badge";
import { TournamentNav } from "@/components/tournament/tournament-nav";
import { requireUser } from "@/lib/auth/session";
import { TOURNAMENT_ART } from "@/lib/tournament/art";
import { formatDateRange } from "@/lib/tournament/dates";
import { getOrganizerTournament } from "@/lib/tournament/queries";
import { getSportTheme } from "@/sports/registry";

/**
 * Frame for every organizer page of one tournament: a banner with its name
 * and status, and the tabs that walk through running it.
 */
export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}`);

  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament, counts } = result;
  const sport = getSportTheme(tournament.sport);
  const facts = [formatDateRange(tournament.starts_on, tournament.ends_on), tournament.venue]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-[var(--y-half-default)]">
      {/* Bleeds past the dashboard's gutter and top padding to the edges. */}
      <div className="relative isolate -mx-[var(--x-default)] -mt-[var(--y-default)] overflow-clip">
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image
            src={TOURNAMENT_ART.banner}
            alt=""
            fill
            priority
            sizes="100vw"
            className="media-settle object-cover object-[50%_40%]"
          />
          <div className="absolute inset-0 bg-background/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
        </div>

        <div className="flex min-h-[34svh] flex-col justify-end gap-5 gutter pt-10 pb-8">
          <Link
            href="/dashboard"
            className="text-sm font-light text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
          >
            ← All tournaments
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tournament.status} />
            <p className="eyebrow text-foreground/70">
              {sport.name}
              {facts ? `, ${facts}` : ""}
            </p>
          </div>
          <RevealText
            as="h1"
            split="lines"
            trigger={false}
            className="max-w-5xl pb-1 text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.95] font-semibold break-words"
          >
            {tournament.name}
          </RevealText>
        </div>
      </div>

      <TournamentNav tournamentId={tournament.id} pendingEntries={counts.pending} />

      <div>{children}</div>
    </div>
  );
}
