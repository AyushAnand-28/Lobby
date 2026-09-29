import Image from "next/image";
import { TrophyIcon } from "lucide-react";

import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";
import { TOURNAMENT_ART } from "@/lib/tournament/art";
import type { TournamentView } from "@/lib/tournament/view";
import { cn } from "@/lib/utils";

/**
 * Champion, runner-up and third, once they are settled. Renders nothing
 * before then: a leader with matches left is never announced.
 *
 * The moment the tournament exists for, so it gets the room: a photograph
 * behind it and the champion's name revealed line by line.
 *
 * - `card` sits in a column on the organizer's and scorer's screens.
 * - `band` runs edge to edge on the public page, with the photograph drifting
 *   on scroll.
 */
export function PodiumCard({
  view,
  variant = "card",
}: {
  view: TournamentView;
  variant?: "card" | "band";
}) {
  const podium = view.podium;
  if (!podium?.champion) return null;

  const name = (id: string | null) => (id ? view.entries.get(id)?.name ?? "Unknown entry" : null);
  const places = [
    { label: "Runner-up", name: name(podium.runnerUp) },
    { label: "Third", name: name(podium.third) },
  ].filter((place) => place.name);

  const band = variant === "band";

  return (
    <section
      aria-label="Podium"
      className={cn(
        "relative isolate overflow-clip",
        band ? "flex min-h-[72svh] items-end gutter py-[var(--y-default)]" : "border border-foreground/30",
      )}
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        {band ? (
          <Parallax strength={14} className="absolute inset-0">
            {/* Sized to Parallax's taller inner box, not `fill`: the box it
                moves is what the photograph has to cover. */}
            <Image
              src={TOURNAMENT_ART.podium}
              alt=""
              width={2000}
              height={1335}
              sizes="100vw"
              className="size-full object-cover"
            />
          </Parallax>
        ) : (
          <Image src={TOURNAMENT_ART.podium} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-background/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
      </div>

      <div className={cn("grid w-full gap-8", band ? "max-w-6xl" : "p-[var(--x-double-default)] pt-24")}>
        <div className="grid gap-4">
          <p className="eyebrow text-foreground/70">
            <TrophyIcon aria-hidden className="size-4" /> Champion
          </p>
          <RevealText
            as="p"
            split="lines"
            className={cn(
              "leading-[0.95] font-semibold break-words",
              band ? "text-[clamp(2.75rem,9vw,8rem)]" : "text-[clamp(2rem,5vw,4rem)]",
            )}
          >
            {name(podium.champion)}
          </RevealText>
        </div>
        {places.length > 0 ? (
          <Reveal as="dl" stagger y={24} className="grid gap-6 sm:grid-cols-2">
            {places.map((place) => (
              <div key={place.label} className="grid gap-1 border-t border-foreground/25 pt-4">
                <dt className="text-sm font-light text-foreground/60 uppercase">{place.label}</dt>
                <dd className={cn("font-medium", band ? "text-3xl" : "text-2xl")}>{place.name}</dd>
              </div>
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
