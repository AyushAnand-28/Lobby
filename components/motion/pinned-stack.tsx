"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * Cards that stack on top of one another as you scroll past them.
 *
 * The reference pins its services section with ScrollTrigger and scrubs the
 * transition. This uses `position: sticky` for the pinning and reserves
 * ScrollTrigger for the scrubbed depth cue — outgoing cards scale down and
 * dim slightly as the next one covers them.
 *
 * Sticky rather than ScrollTrigger's `pin` on purpose: pinning rewrites the
 * document height and has to be recalculated whenever anything above it
 * reflows, which is exactly the kind of thing that breaks when an image loads
 * late. Sticky is handled by the compositor and cannot desync.
 */
export function PinnedStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || prefersReducedMotion()) return;

      const cards = Array.from(
        root.querySelectorAll<HTMLElement>("[data-stack-card]"),
      );

      cards.forEach((card, i) => {
        /*
         * Later cards must paint over earlier ones. Transformed elements are
         * painted as positioned descendants, so DOM order alone does not
         * guarantee it once `scale` is applied — an explicit z-index does.
         */
        card.style.zIndex = String(i + 1);

        // The last card is never covered, so it never recedes.
        if (i === cards.length - 1) return;

        const scrim = card.querySelector("[data-stack-scrim]");

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: cards[i + 1],
            /*
             * Drive the recede off the *next* card's approach: it starts when
             * the covering card enters from the bottom and completes as it
             * lands, so the two movements are locked together.
             */
            start: "top bottom",
            end: "top top",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });

        timeline.to(card, { scale: 0.94, ease: "none" }, 0);

        /*
         * Dim with an opaque scrim rather than by fading the card itself.
         * Fading makes the card translucent, which lets the card *underneath*
         * show through — the outgoing content ends up ghosted over its own
         * replacement.
         */
        if (scrim) timeline.to(scrim, { opacity: 0.72, ease: "none" }, 0);
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}

export function StackCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-stack-card
      className={cn(
        "relative isolate sticky top-[var(--y-half-default)] origin-top",
        // Its own ground, or the card beneath would show through as it recedes.
        "bg-mist",
        className,
      )}
    >
      {children}
      {/* Opaque dimmer, faded in as the next card arrives. */}
      <div
        data-stack-scrim
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-background opacity-0"
      />
    </div>
  );
}
