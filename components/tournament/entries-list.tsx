import type { OrganizerEntry } from "@/lib/tournament/queries";
import type { ParticipantStatus } from "@/lib/tournament/types";
import { EntryActions } from "./entry-actions";

const ENTRY_GROUPS: { id: string; title: string; statuses: ParticipantStatus[] }[] = [
  { id: "entries-pending", title: "Waiting for approval", statuses: ["pending"] },
  { id: "entries-approved", title: "Approved", statuses: ["approved"] },
  { id: "entries-rejected", title: "Rejected or withdrawn", statuses: ["rejected", "withdrawn"] },
];

/**
 * Every entry, grouped by where it stands, with contact details — this is the
 * organizer's view, so phone numbers are shown. Decisions are offered only
 * while the draw is still open.
 */
export function EntriesList({
  tournamentId,
  entries,
  editable,
}: {
  tournamentId: string;
  entries: OrganizerEntry[];
  editable: boolean;
}) {
  // A singles entry's one player is the entry's own name; listing it again adds nothing.
  const showPlayers = entries.some((entry) => entry.players.length > 1);

  if (entries.length === 0) {
    return (
      <p className="max-w-lg text-base leading-relaxed font-light text-foreground/60">
        No entries yet. They appear here as captains submit them from the registration link, or
        add them yourself below.
      </p>
    );
  }

  return (
    <div className="grid gap-10">
      {ENTRY_GROUPS.map((group) => {
        const rows = entries.filter((entry) => group.statuses.includes(entry.status));
        if (rows.length === 0) return null;

        return (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="grid gap-3">
            <h2 id={`${group.id}-heading`} className="text-sm font-light text-foreground/55 uppercase">
              {group.title} · {rows.length}
            </h2>
            <ul className="grid border-t border-border">
              {rows.map((entry) => (
                <li
                  key={entry.id}
                  className="grid gap-4 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-8"
                >
                  <EntryDetails entry={entry} showPlayers={showPlayers} />
                  {editable ? (
                    <EntryActions
                      tournamentId={tournamentId}
                      participantId={entry.id}
                      status={entry.status}
                      entryName={entry.name}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EntryDetails({ entry, showPlayers }: { entry: OrganizerEntry; showPlayers: boolean }) {
  const contact = entry.contact;
  const about = [
    showPlayers && entry.players.length > 0 ? entry.players.join(" & ") : null,
    entry.club,
    entry.source === "organizer" ? "Added by you" : null,
  ].filter(Boolean);

  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-xl font-medium break-words">
        {entry.seed ? (
          <span className="mr-2 inline-flex size-7 items-center justify-center bg-foreground align-middle text-sm text-background">
            {entry.seed}
            <span className="sr-only"> seed</span>
          </span>
        ) : null}
        {entry.name}
      </p>
      {about.length > 0 ? (
        <p className="text-base font-light text-foreground/70">{about.join(" · ")}</p>
      ) : null}
      {contact ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-light text-foreground/60">
          <span>{contact.captain_name}</span>
          {contact.phone ? (
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {contact.phone}
            </a>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="break-all underline underline-offset-4 hover:text-foreground"
            >
              {contact.email}
            </a>
          ) : null}
        </p>
      ) : null}
      {contact?.note ? (
        <p className="text-sm font-light whitespace-pre-line text-foreground/60">{contact.note}</p>
      ) : null}
    </div>
  );
}
