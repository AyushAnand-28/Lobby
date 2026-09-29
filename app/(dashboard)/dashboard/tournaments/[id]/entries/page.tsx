import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EntriesList } from "@/components/tournament/entries-list";
import { requireUser } from "@/lib/auth/session";
import { getOrganizerTournament } from "@/lib/tournament/queries";
import { getEntryKind } from "@/sports/registry";
import { AddEntryForm } from "./add-entry-form";
import { SeedsForm } from "./seeds-form";

export const metadata: Metadata = {
  title: "Entries",
};

export default async function EntriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/entries`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament, entries, counts } = result;
  const editable = tournament.status === "draft" || tournament.status === "registration";
  const entryKind = getEntryKind(tournament.sport, tournament.settings);
  const approved = entries.filter((entry) => entry.status === "approved");

  return (
    <div className="grid gap-[var(--y-default)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-[var(--x-double-default)]">
      <div className="grid content-start gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl font-medium">Entries</h2>
          <p className="text-sm font-light text-foreground/60">
            {counts.approved} approved
            {tournament.max_participants ? ` of ${tournament.max_participants}` : ""} ·{" "}
            {counts.pending} waiting
          </p>
        </div>
        {!editable ? (
          <p className="border border-border bg-mist p-5 text-base font-light text-foreground/70">
            The draw has been made, so entries are fixed. To change them,{" "}
            <Link href={`/dashboard/tournaments/${id}/draw`} className="underline underline-offset-4">
              reset the draw
            </Link>{" "}
            first. That works until a match is played.
          </p>
        ) : null}
        <EntriesList tournamentId={tournament.id} entries={entries} editable={editable} />
      </div>

      {editable ? (
        <div className="grid content-start gap-[var(--y-half-default)]">
          <section aria-labelledby="add-heading" className="grid gap-6 border border-border p-[var(--x-double-default)]">
            <div className="grid gap-2">
              <h2 id="add-heading" className="text-2xl font-medium">
                Add an entry
              </h2>
              <p className="text-sm font-light text-foreground/60">
                For walk-ins, or a {entryKind.noun} that sent their names by phone. Added
                approved.
              </p>
            </div>
            <AddEntryForm
              tournamentId={tournament.id}
              entryNoun={entryKind.noun}
              rosterMin={tournament.roster_min}
              rosterMax={tournament.roster_max}
            />
          </section>

          {approved.length >= 2 ? (
            <section aria-labelledby="seeds-heading" className="grid gap-6 border border-border p-[var(--x-double-default)]">
              <div className="grid gap-2">
                <h2 id="seeds-heading" className="text-2xl font-medium">
                  Seeds
                </h2>
                <p className="text-sm font-light text-foreground/60">
                  Optional. Seed the strongest few; 1 is the favourite. Seeds are kept apart
                  until the late rounds; everyone else is drawn around them.
                </p>
              </div>
              <SeedsForm
                tournamentId={tournament.id}
                entries={approved.map(({ id: entryId, name, seed }) => ({ id: entryId, name, seed }))}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
