"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Single registration point for the animation layer.
 *
 * gsap.registerPlugin is idempotent, but importing the plugins from one module
 * means every consumer gets the same instances and there is exactly one place
 * to look when something is not animating.
 *
 * All four of these ship free from GSAP 3.13 onwards — SplitText in particular
 * used to be licence-gated, so older guidance about avoiding it no longer
 * applies.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Observer);
}

/**
 * The reference's motion signature, extracted from its shipped bundles rather
 * than guessed at. Keeping these as named constants is what stops a hand-tuned
 * `duration: 0.9` creeping in somewhere and quietly breaking the rhythm.
 */
export const EASE = {
  /** The workhorse. Long, decisive settle — used for every entrance. */
  out: "power4.out",
  /** Shorter settle for small elements and hover states. */
  soft: "power2.out",
  /** Exits, where the motion should accelerate away. */
  in: "power2.in",
  /** Symmetric moves — pinned transitions, crossfades. */
  inOut: "power2.inOut",
} as const;

export const DURATION = {
  /** Micro-interactions: hover, focus, small state flips. */
  micro: 0.3,
  /** Standard UI transition. */
  short: 0.4,
  /** The default entrance. */
  base: 1,
  /** Hero and section headlines — deliberately slow. */
  hero: 1.8,
} as const;

export const STAGGER = {
  /** Between lines of a split heading, or sibling cards. */
  line: 0.1,
  /** Between words. */
  word: 0.05,
  /** Between characters. Anything slower reads as a typewriter. */
  char: 0.02,
} as const;

/** The reference reveals content when its top passes 70% of the viewport. */
export const REVEAL_START = "top 70%";

/**
 * Play in, and reverse back out if the user scrolls up past the trigger.
 * The reference uses this everywhere rather than `once: true`.
 */
export const REVEAL_TOGGLE = "play none none reverse";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export { gsap, useGSAP, ScrollTrigger, SplitText, Observer };
