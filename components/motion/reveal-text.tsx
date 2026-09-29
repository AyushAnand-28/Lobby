"use client";

import { useRef, type ElementType } from "react";

import { cn } from "@/lib/utils";
import {
  DURATION,
  EASE,
  REVEAL_START,
  REVEAL_TOGGLE,
  STAGGER,
  SplitText,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "./gsap";

type SplitKind = "lines" | "words" | "chars";

const STAGGER_FOR: Record<SplitKind, number> = {
  lines: STAGGER.line,
  words: STAGGER.word,
  chars: STAGGER.char,
};

/**
 * The signature reveal: text slides up from behind its own clipping box.
 *
 * `mask` is the whole trick. SplitText wraps each line in a second element
 * with `overflow: clip`, so translating the inner line looks like it is being
 * uncovered rather than merely sliding — the difference between this and a
 * plain fade-up is most of why the reference feels expensive.
 */
export function RevealText({
  as: Tag = "div",
  split = "lines",
  delay = 0,
  duration = DURATION.hero,
  trigger = true,
  className,
  children,
}: {
  as?: ElementType;
  split?: SplitKind;
  delay?: number;
  duration?: number;
  /** false = play on mount (hero); true = play when scrolled into view. */
  trigger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (prefersReducedMotion()) {
        el.dataset.ready = "false";
        return;
      }

      // Only hide the text once we know the animation will actually run.
      el.dataset.ready = "true";

      let split_: SplitText | undefined;

      /*
       * Split after the webfont has settled. Splitting against the fallback
       * face measures the wrong line breaks, and the lines then re-wrap under
       * the mask when the real font swaps in.
       */
      const run = () => {
        split_ = SplitText.create(el, {
          /*
           * A bare "chars" split makes every character its own inline-block,
           * which lets the browser break lines *inside* a word — "START TH /
           * E DRAW." Splitting words as well keeps each word an unbreakable
           * box while still animating per character.
           */
          type: split === "chars" ? "words,chars" : split,
          mask: split,
          linesClass: "split-line",
          wordsClass: "split-word",
          charsClass: "split-char",
          /*
           * Re-split on resize. Without this, a line-split heading keeps the
           * line boxes it was measured at and overflows its mask when the
           * viewport narrows.
           */
          autoSplit: true,
          onSplit(self) {
            el.style.visibility = "visible";

            return gsap.from(self[split], {
              yPercent: 100,
              duration,
              delay,
              ease: EASE.out,
              stagger: STAGGER_FOR[split],
              scrollTrigger: trigger
                ? {
                    trigger: el,
                    start: REVEAL_START,
                    toggleActions: REVEAL_TOGGLE,
                  }
                : undefined,
            });
          },
        });
      };

      if (document.fonts?.status === "loaded") run();
      else void document.fonts?.ready.then(run);

      return () => split_?.revert();
    },
    { scope: ref, dependencies: [split, trigger, delay, duration] },
  );

  return (
    <Tag ref={ref} data-reveal className={cn(className)}>
      {children}
    </Tag>
  );
}
