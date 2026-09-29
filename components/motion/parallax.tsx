"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * Scrubbed parallax for imagery.
 *
 * The inner element is deliberately taller than its clipping parent so it has
 * somewhere to travel. The reference runs its range from `top bottom+=100svh`
 * to `bottom top-=100svh`, i.e. it starts moving a full viewport before the
 * element is on screen and keeps going a full viewport after it leaves — which
 * is why nothing ever appears to snap into or out of motion at the edges.
 */
export function Parallax({
  children,
  strength = 15,
  className,
}: {
  children: React.ReactNode;
  /** Travel as a percentage of the element's height. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      const inner = root?.firstElementChild;
      if (!root || !inner || prefersReducedMotion()) return;

      gsap.fromTo(
        inner,
        { yPercent: -strength },
        {
          yPercent: strength,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: () => "top bottom+=100svh",
            end: () => "bottom top-=100svh",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );
    },
    { scope: ref, dependencies: [strength] },
  );

  return (
    <div ref={ref} className={cn("overflow-clip", className)}>
      <div className="h-[130%] w-full will-change-transform">{children}</div>
    </div>
  );
}
