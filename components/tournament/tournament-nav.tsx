"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: null, label: "Overview" },
  { segment: "entries", label: "Entries" },
  { segment: "draw", label: "Draw" },
  { segment: "matches", label: "Matches" },
  { segment: "standings", label: "Standings" },
  { segment: "edit", label: "Edit" },
] as const;

/**
 * Tabs across a tournament's organizer pages. Scrolls sideways on a phone
 * rather than wrapping, so the row keeps its place under the title.
 */
export function TournamentNav({
  tournamentId,
  pendingEntries,
}: {
  tournamentId: string;
  pendingEntries: number;
}) {
  const [active = null] = useSelectedLayoutSegments();
  const base = `/dashboard/tournaments/${tournamentId}`;

  return (
    <nav aria-label="Tournament" className="-mx-[var(--x-default)] overflow-x-auto border-b border-border px-[var(--x-default)]" data-lenis-prevent>
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const current = tab.segment === active;
          return (
            <li key={tab.label}>
              <Link
                href={tab.segment ? `${base}/${tab.segment}` : base}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium tracking-[0.08em] uppercase outline-ring/50 focus-visible:outline-2",
                  current
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/50 hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.segment === "entries" && pendingEntries > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center bg-flame px-1.5 text-xs text-flame-foreground">
                    {pendingEntries}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
