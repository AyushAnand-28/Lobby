import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TournamentForm } from "@/components/tournament/tournament-form";
import { requireUser } from "@/lib/auth/session";
import { updateTournamentAction } from "@/lib/tournament/actions";
import { getOrganizerTournament } from "@/lib/tournament/queries";
import { parseBadmintonSettings } from "@/sports/badminton/rules";
import { DeleteTournamentForm } from "./delete-form";

export const metadata: Metadata = {
  title: "Edit tournament",
};

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/tournaments/${id}/edit`);
  const result = await getOrganizerTournament(user.id, id);
  if (!result) notFound();

  const { tournament, counts } = result;
  const settings = parseBadmintonSettings(tournament.settings);
  const drawn = tournament.status === "in_progress" || tournament.status === "completed";
  const text = (value: string | number | null) => (value === null ? "" : String(value));

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-[var(--y-default)]">
      <TournamentForm
        action={updateTournamentAction.bind(null, tournament.id)}
        initial={{
          name: tournament.name,
          venue: text(tournament.venue),
          startsOn: text(tournament.starts_on),
          endsOn: text(tournament.ends_on),
          courtCount: text(tournament.court_count),
          entryType: settings.entryType,
          scoringPreset: settings.scoringPreset,
          format: tournament.format,
          groupCount: text(tournament.group_count),
          advancePerGroup: text(tournament.advance_per_group),
          maxParticipants: text(tournament.max_participants),
          thirdPlaceMatch: tournament.third_place_match ? "on" : "",
          description: text(tournament.description),
        }}
        lockDraw={drawn}
        lockEvent={counts.pending + counts.approved > 0}
        submitLabel="Save changes"
        pendingLabel="Saving…"
      />

      <section className="grid gap-4 border-t border-destructive/40 pt-8">
        <h2 className="text-2xl font-medium">Delete tournament</h2>
        <DeleteTournamentForm tournamentId={tournament.id} name={tournament.name} />
      </section>
    </div>
  );
}
