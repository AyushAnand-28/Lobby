"use client";

import { useRef, type ElementType } from "react";

import { cn } from "@/lib/utils";
import {
  DURATION,
  EASE,
  REVEAL_START,
  REVEAL_TOGGLE,
  STAGGER,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "./gsap";

/**
 * Generic scroll-in reveal for anything that is not text — images, cards,
 * rules, whole grids.
 *
 * `stagger` targets direct children, which is how the reference brings a row
 * of cards in: one trigger on the container rather than one per card, so the
 * cadence stays even no matter how fast the user scrolls past.
 */
export function Reveal({
  as: Tag = "div",
  y = 40,
  delay = 0,
  duration = DURATION.base,
  stagger = false,
  trigger = true,
  className,
  children,
}: {
  as?: ElementType;
  /** Distance travelled, in px. The reference stays under ~48. */
  y?: number;
  delay?: number;
  duration?: number;
  /** Animate direct children in sequence instead of the element itself. */
  stagger?: boolean;
  /**
   * false = play on mount. Required for anything already on screen at load:
   * a scroll trigger set at 70% of the viewport never fires for content that
   * starts below that line and is never scrolled past, leaving it stuck at
   * opacity 0.
   */
  trigger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;

      const targets = stagger ? Array.from(el.children) : el;
      if (stagger && !el.children.length) return;

      gsap.from(targets, {
        opacity: 0,
        y,
        duration,
        delay,
        ease: EASE.out,
        stagger: stagger ? STAGGER.line : 0,
        scrollTrigger: trigger
          ? {
              trigger: el,
              start: REVEAL_START,
              toggleActions: REVEAL_TOGGLE,
            }
          : undefined,
      });
    },
    { scope: ref, dependencies: [y, delay, duration, stagger, trigger] },
  );

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
