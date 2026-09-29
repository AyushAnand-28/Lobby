import type { Table, TournamentView } from "@/lib/tournament/view";
import { cn } from "@/lib/utils";

/**
 * A league or group table. The columns are the ones that decide places in
 * badminton — matches, then games, then points — so a spectator can see why
 * someone is above someone else.
 */
export function StandingsTable({
  view,
  table,
  advance,
}: {
  view: TournamentView;
  table: Table;
  /** How many go through from this table; they are marked. */
  advance?: number | null;
}) {
  return (
    <div className="-mx-[var(--x-default)] overflow-x-auto px-[var(--x-default)]" data-lenis-prevent>
      <table className="w-full min-w-[34rem] border-collapse text-left tabular-nums">
        <caption className="sr-only">
          {table.label ? `Group ${table.label}` : "League"} standings
        </caption>
        <thead>
          <tr className="border-b border-border text-xs font-light tracking-[0.06em] text-foreground/55 uppercase">
            <th scope="col" className="w-8 py-2 pr-2 font-light">#</th>
            <th scope="col" className="py-2 pr-4 font-light">Entry</th>
            <Th title="Played">P</Th>
            <Th title="Won">W</Th>
            <Th title="Lost">L</Th>
            <Th title="Games won-lost">Games</Th>
            <Th title="Point difference">Pts ±</Th>
            <th scope="col" className="hidden py-2 pl-3 font-light sm:table-cell">Form</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const through = advance ? row.position <= advance : false;
            const entry = view.entries.get(row.participantId);
            return (
              <tr
                key={row.participantId}
                className={cn("border-b border-border", entry?.status === "withdrawn" && "text-foreground/45")}
              >
                <td className="py-3 pr-2">
                  <span className={cn(through && "inline-flex size-6 items-center justify-center bg-foreground text-background")}>
                    {row.position}
                  </span>
                </td>
                <td className="py-3 pr-4 font-medium">
                  {entry?.name ?? "Unknown entry"}
                  {entry?.status === "withdrawn" ? <span className="ml-2 text-xs font-light uppercase">Withdrawn</span> : null}
                </td>
                <Td>{row.played}</Td>
                <Td>{row.won}</Td>
                <Td>{row.lost}</Td>
                <Td>
                  {row.gamesWon}-{row.gamesLost}
                </Td>
                <Td>{row.pointDifference > 0 ? `+${row.pointDifference}` : row.pointDifference}</Td>
                <td className="hidden py-3 pl-3 sm:table-cell">
                  <span className="flex gap-1">
                    {row.form.map((result, index) => (
                      <span
                        key={index}
                        aria-label={result === "W" ? "Won" : "Lost"}
                        className={cn(
                          "inline-flex size-5 items-center justify-center text-[0.65rem] font-semibold",
                          result === "W" ? "bg-foreground text-background" : "border border-border text-foreground/55",
                        )}
                      >
                        {result}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {advance ? (
        <p className="mt-3 text-sm font-light text-foreground/55">
          Top {advance} go through{table.complete ? "" : " once every match is played"}.
        </p>
      ) : null}
    </div>
  );
}

function Th({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <th scope="col" title={title} className="px-2 py-2 text-right font-light">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-3 text-right">{children}</td>;
}
