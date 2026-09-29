"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { EASE, gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * A figure on a page that updates live: matches played, courts in use.
 *
 * `Counter` counts up from zero, which is right once, when the page opens, and
 * wrong every time after: a live update would send "12 played" back to zero
 * and up again. This counts up on arrival only; after that, a new value rolls
 * in the way a score does (`score-roll` in globals.css).
 *
 * The final value is rendered on the server, so it is correct with no JS and
 * under reduced motion; the count-up only rewrites text already there.
 */
export function LiveNumber({
  value,
  duration = 1.6,
  delay = 0,
  className,
}: {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [settled, setSettled] = useState(false);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion() || value === 0) {
        setSettled(true);
        return;
      }

      const counter = { n: 0 };
      gsap.to(counter, {
        n: value,
        duration,
        delay,
        ease: EASE.out,
        snap: { n: 1 },
        onUpdate() {
          el.textContent = String(Math.round(counter.n));
        },
        onComplete() {
          setSettled(true);
        },
      });
    },
    // Once, on arrival. Later values are handled by the keyed span below.
    { scope: ref },
  );

  return (
    <span className={cn("inline-block tabular-nums", className)}>
      {/* Keyed on the value: a live change remounts it and rolls it in. */}
      <span key={value} ref={ref} className={settled ? "score-roll" : undefined}>
        {value}
      </span>
    </span>
  );
}
