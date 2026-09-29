"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import { EASE, gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * The oversized footer wordmark, set edge to edge with imagery showing through
 * the letterforms.
 *
 * The reference does this with `background-clip: text` over a photograph, then
 * splits the word into per-character spans so each letter can be animated
 * independently while the background stays continuous across all of them —
 * that continuity is the point, and it is why this cannot be done with one
 * gradient per character.
 *
 * `background-attachment` stays default: the fill is positioned against this
 * element, so it lines up across the characters no matter where the footer
 * sits in the document.
 */
export function GiantWordmark({
  word,
  image,
  className,
}: {
  word: string;
  /** Optional photograph to show through the letters. */
  image?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const characters = Array.from(word);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || prefersReducedMotion()) return;

      gsap.from(root.querySelectorAll("[data-char]"), {
        yPercent: 110,
        duration: 1.2,
        ease: EASE.out,
        stagger: 0.04,
        scrollTrigger: {
          trigger: root,
          /*
           * Fires late — `top 95%` rather than the usual 70% — because the
           * wordmark is the last thing on the page and should land as the
           * footer settles, not before the user can see it.
           */
          start: "top 95%",
          toggleActions: "play none none reverse",
        },
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      aria-label={word}
      role="img"
      className={cn("w-full overflow-clip leading-none select-none", className)}
    >
      <div
        className="flex w-full justify-between bg-cover bg-center bg-no-repeat font-semibold whitespace-nowrap"
        style={{
          // 100vw across the full word, minus the page gutters.
          fontSize: `calc((100vw - 2 * var(--x-default)) / ${characters.length} * 1.42)`,
          /*
           * The fallback fill is tuned for the inverted white band the footer
           * sits on — a white-based gradient would simply disappear there.
           */
          backgroundImage: image
            ? `url(${image})`
            : "linear-gradient(115deg, #0a0a0a 0%, #1b17ee 42%, #6b6b6b 72%, #0a0a0a 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {/*
         * Characters are plain inline-blocks with no clipping of their own.
         * `background-clip: text` cannot clip a gradient through a descendant
         * that establishes its own overflow context — wrap each character in
         * an `overflow: clip` mask and the fill renders as nothing at all.
         * The reveal is masked by the outer container instead.
         */}
        {characters.map((char, i) => (
          <span key={`${char}-${i}`} data-char className="inline-block">
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}
