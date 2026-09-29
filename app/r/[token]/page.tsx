import type { Metadata } from "next";
import Image from "next/image";

import { Wordmark } from "@/components/brand";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";
import { TOURNAMENT_ART } from "@/lib/tournament/art";
import { formatDateRange } from "@/lib/tournament/dates";
import { getRegistrationPreview } from "@/lib/tournament/queries";
import { REGISTRATION_BLOCK_COPY } from "@/lib/tournament/registration";
import { FORMATS } from "@/lib/tournament/types";
import { getEntryKind, getScoringEngine, getSportTheme } from "@/sports/registry";
import { RegistrationForm } from "./registration-form";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const preview = await getRegistrationPreview(token);
  return {
    title: preview?.tournament ? `Enter ${preview.tournament.name}` : "Registration",
    // A registration link is shared privately; keep it out of search results.
    robots: { index: false, follow: false },
  };
}

export default async function RegistrationPage({ params }: Props) {
  const { token } = await params;
  const preview = await getRegistrationPreview(token);
  const tournament = preview?.tournament ?? null;

  if (!preview || !tournament) {
    const copy = preview
      ? REGISTRATION_BLOCK_COPY.not_published
      : {
          title: "This link is not valid",
          body: "It may have been replaced by a newer one. Ask the organizer for the current registration link.",
        };
    return (
      <Split heading="Registration" facts={null}>
        <Notice {...copy} />
      </Split>
    );
  }

  const sport = getSportTheme(tournament.sport);
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const scoring = getScoringEngine(tournament.sport, tournament.settings);
  const dates = formatDateRange(tournament.starts_on, tournament.ends_on);
  const facts = [dates, tournament.venue, `${sport.name} ${entryKind.label.toLowerCase()}`].filter(
    (fact): fact is string => Boolean(fact),
  );

  return (
    <Split heading={tournament.name} facts={facts}>
      <div className="grid gap-10">
        <div className="grid gap-4">
          <h2 className="text-3xl font-medium">
            {preview.accepting ? `Enter a ${entryKind.noun}` : "Registration"}
          </h2>
          <p className="text-sm font-light text-foreground/60">
            {FORMATS[tournament.format].label}. {scoring.summary}.
          </p>
          {tournament.description ? (
            <p className="text-base leading-relaxed font-light whitespace-pre-line text-foreground/75">
              {tournament.description}
            </p>
          ) : null}
        </div>

        {preview.accepting ? (
          <RegistrationForm
            token={token}
            entryNoun={entryKind.noun}
            rosterMin={tournament.roster_min}
            rosterMax={tournament.roster_max}
          />
        ) : (
          <Notice {...REGISTRATION_BLOCK_COPY[preview.reason === "open" ? "closed" : preview.reason]} />
        )}
      </div>
    </Split>
  );
}

/**
 * Photograph on the left with the tournament's name over it, form on the
 * right. On a phone the photograph becomes a shallow banner so the form starts
 * near the top of the screen.
 */
function Split({
  heading,
  facts,
  children,
}: {
  heading: string;
  facts: string[] | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate flex min-h-[42svh] flex-col justify-between overflow-clip gutter py-[var(--y-half-default)] lg:sticky lg:top-0 lg:h-svh lg:py-[var(--y-default)]">
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image
            src={TOURNAMENT_ART.register}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="media-settle object-cover object-[50%_30%]"
          />
          <div className="absolute inset-0 bg-background/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/60" />
        </div>

        <Wordmark />

        <div className="grid gap-4">
          <p className="eyebrow text-foreground/75">Registration</p>
          <RevealText
            as="h1"
            split="lines"
            trigger={false}
            className="pb-1 text-[clamp(2.25rem,5.5vw,5rem)] leading-[0.95] font-semibold break-words"
          >
            {heading}
          </RevealText>
          {facts && facts.length > 0 ? (
            <Reveal y={16} delay={0.5} trigger={false}>
              <p className="text-base font-light text-foreground/80">{facts.join(", ")}</p>
            </Reveal>
          ) : null}
        </div>
      </aside>

      <main className="gutter py-[var(--y-default)]">
        <Reveal y={24} delay={0.3} trigger={false} className="mx-auto w-full max-w-xl">
          {children}
        </Reveal>
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-4 border border-border bg-mist p-[var(--x-double-default)]">
      <h2 className="text-2xl font-medium">{title}</h2>
      <p className="text-base leading-relaxed font-light text-foreground/70">{body}</p>
    </div>
  );
}
