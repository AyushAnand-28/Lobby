import { cn } from "@/lib/utils";

/**
 * A live score. Keyed on its value, so each new point remounts the span and
 * plays the `score-roll` animation once (see globals.css); a refresh that
 * leaves the score unchanged leaves it still.
 */
export function ScoreDigit({ value, className }: { value: number; className?: string }) {
  return (
    <span key={value} className={cn("score-roll tabular-nums", className)}>
      {value}
    </span>
  );
}
