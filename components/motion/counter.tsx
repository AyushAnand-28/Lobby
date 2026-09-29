"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import {
  EASE,
  REVEAL_START,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "./gsap";

/**
 * Count-up figure for the stats band.
 *
 * The number is rendered server-side at its final value, so it is correct for
 * search engines, screen readers and anyone with JS off or reduced motion on —
 * the animation only ever rewrites text that is already there.
 */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  duration = 2,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;

      const counter = { n: 0 };

      gsap.to(counter, {
        n: value,
        duration,
        ease: EASE.out,
        /*
         * snap keeps the digits integral while tweening — without it the
         * counter flickers through fractional values and reads as noise.
         */
        snap: { n: 1 },
        onUpdate() {
          el.textContent = `${prefix}${Math.round(counter.n).toLocaleString()}${suffix}`;
        },
        scrollTrigger: {
          trigger: el,
          start: REVEAL_START,
          // Counting back down on scroll-up looks broken; play once only.
          toggleActions: "play none none none",
          once: true,
        },
      });
    },
    { scope: ref, dependencies: [value, prefix, suffix, duration] },
  );

  return (
    <span ref={ref} className={cn(className)}>
      {`${prefix}${value.toLocaleString()}${suffix}`}
    </span>
  );
}
