import { STATUS_LABELS, type TournamentStatus } from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

/**
 * Tournament status as a small outlined label. The accent dot marks the two
 * live states — the accent colour is reserved for live state and focus.
 */
export function StatusBadge({ status }: { status: TournamentStatus }) {
  const live = status === "registration" || status === "in_progress";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium tracking-[0.08em] uppercase",
        live ? "border-foreground/60 text-foreground" : "border-border text-foreground/60",
      )}
    >
      {live ? <span aria-hidden className="size-1.5 rounded-full bg-flame" /> : null}
      {STATUS_LABELS[status]}
    </span>
  );
}
