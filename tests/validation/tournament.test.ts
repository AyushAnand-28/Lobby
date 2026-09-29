import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createTournamentSchema, registrationSchema } from "@/lib/validation/tournament";

/** What the create form posts when only the required fields are filled. */
const minimal = {
  name: "City Open",
  format: "knockout",
  entryType: "singles",
  scoringPreset: "standard",
  thirdPlaceMatch: false,
  groupCount: "",
  advancePerGroup: "",
  maxParticipants: "",
  courtCount: "",
  venue: "",
  startsOn: "",
  endsOn: "",
  description: "",
};

function fieldErrors(result: { success: boolean; error?: z.ZodError }) {
  return result.error ? z.flattenError(result.error).fieldErrors : {};
}

describe("createTournamentSchema", () => {
  it("accepts the minimal form and turns blanks into undefined", () => {
    const result = createTournamentSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "City Open",
      venue: undefined,
      startsOn: undefined,
      maxParticipants: undefined,
      groupCount: undefined,
    });
  });

  it("trims the name and holds it to the column's 3 to 120 characters", () => {
    expect(createTournamentSchema.safeParse({ ...minimal, name: "  Cup  " }).data?.name).toBe("Cup");
    expect(fieldErrors(createTournamentSchema.safeParse({ ...minimal, name: " ab " }))).toHaveProperty(
      "name",
    );
    expect(createTournamentSchema.safeParse({ ...minimal, name: "x".repeat(121) }).success).toBe(false);
  });

  it("requires group settings only for the groups format", () => {
    const groups = createTournamentSchema.safeParse({ ...minimal, format: "groups_knockout" });
    expect(fieldErrors(groups)).toHaveProperty("groupCount");
    expect(fieldErrors(groups)).toHaveProperty("advancePerGroup");

    const configured = createTournamentSchema.safeParse({
      ...minimal,
      format: "groups_knockout",
      groupCount: "4",
      advancePerGroup: "2",
    });
    expect(configured.data).toMatchObject({ groupCount: 4, advancePerGroup: 2 });
  });

  it.each([
    ["groupCount", "1"],
    ["groupCount", "9"],
    ["advancePerGroup", "5"],
    ["maxParticipants", "1"],
    ["maxParticipants", "257"],
    ["maxParticipants", "12.5"],
    ["maxParticipants", "lots"],
  ])("rejects %s = %p", (field, value) => {
    const result = createTournamentSchema.safeParse({
      ...minimal,
      format: "groups_knockout",
      groupCount: "4",
      advancePerGroup: "2",
      [field]: value,
    });
    expect(fieldErrors(result)).toHaveProperty(field);
  });

  it("rejects a last day before the first", () => {
    const result = createTournamentSchema.safeParse({
      ...minimal,
      startsOn: "2026-10-12",
      endsOn: "2026-10-11",
    });
    expect(fieldErrors(result)).toHaveProperty("endsOn");

    const sameDay = createTournamentSchema.safeParse({
      ...minimal,
      startsOn: "2026-10-12",
      endsOn: "2026-10-12",
    });
    expect(sameDay.success).toBe(true);
  });

  it("rejects values the form never offers", () => {
    expect(createTournamentSchema.safeParse({ ...minimal, format: "swiss" }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...minimal, entryType: "triples" }).success).toBe(false);
    expect(createTournamentSchema.safeParse({ ...minimal, scoringPreset: "to-99" }).success).toBe(false);
  });
});

const entry = {
  name: "Rao / Menon",
  players: ["Asha Rao", "Kiran Menon"],
  club: "",
  captainName: "Asha Rao",
  phone: "98450 12345",
  email: "",
};

describe("registrationSchema", () => {
  it("accepts an entry and turns optional blanks into undefined", () => {
    const result = registrationSchema.safeParse(entry);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ club: undefined, email: undefined });
  });

  it("requires a phone number the organizer can call", () => {
    expect(fieldErrors(registrationSchema.safeParse({ ...entry, phone: "" }))).toHaveProperty("phone");
    expect(fieldErrors(registrationSchema.safeParse({ ...entry, phone: "call me" }))).toHaveProperty(
      "phone",
    );
  });

  it("normalises the email and rejects a malformed one", () => {
    expect(registrationSchema.safeParse({ ...entry, email: " Asha@Example.COM " }).data?.email).toBe(
      "asha@example.com",
    );
    expect(fieldErrors(registrationSchema.safeParse({ ...entry, email: "asha@" }))).toHaveProperty(
      "email",
    );
  });

  it("holds names to the column's 80 characters", () => {
    const long = "x".repeat(81);
    expect(fieldErrors(registrationSchema.safeParse({ ...entry, name: long }))).toHaveProperty("name");
    expect(
      fieldErrors(registrationSchema.safeParse({ ...entry, players: ["Asha", long] })),
    ).toHaveProperty("players");
  });
});
