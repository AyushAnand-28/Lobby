import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeRegistrationError,
  REGISTRATION_BLOCK_COPY,
  type RegistrationBlock,
} from "@/lib/tournament/registration";

const GENERIC = describeRegistrationError("something_else", "pair").message;

/** Every code `submit_registration()` raises, read from the migration itself. */
function codesRaisedBySubmitRegistration(): string[] {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260921120200_tournament_functions.sql"),
    "utf8",
  );
  const body = sql.slice(
    sql.indexOf("function public.submit_registration("),
    sql.indexOf("function public.rotate_registration_token("),
  );
  return [...body.matchAll(/raise exception '([a-z_%]+)'/g)].map((match) => match[1]);
}

describe("describeRegistrationError", () => {
  it("has specific copy for every code the database raises", () => {
    const codes = codesRaisedBySubmitRegistration();
    expect(codes).toContain("invalid_token");

    for (const code of codes) {
      if (code === "registration_%") continue; // expanded below
      if (code === "invalid_input") continue; // over-long optional field; the form prevents it
      expect(describeRegistrationError(code, "pair").message, code).not.toBe(GENERIC);
    }
  });

  it.each(Object.keys(REGISTRATION_BLOCK_COPY) as RegistrationBlock[])(
    "explains registration_%s with the captain-facing copy",
    (block) => {
      expect(describeRegistrationError(`registration_${block}`, "pair")).toEqual({
        message: REGISTRATION_BLOCK_COPY[block].body,
      });
    },
  );

  it("puts field problems next to the field", () => {
    expect(describeRegistrationError("duplicate_name", "pair")).toMatchObject({ field: "name" });
    expect(describeRegistrationError("duplicate_name", "pair").message).toContain("pair");
    expect(describeRegistrationError("invalid_players", "pair").field).toBe("players");
    expect(describeRegistrationError("invalid_phone", "pair").field).toBe("phone");
    expect(describeRegistrationError("invalid_captain", "pair").field).toBe("captainName");
  });

  it("falls back to a generic message for anything unrecognised", () => {
    expect(describeRegistrationError("registration_unknown", "pair")).toEqual({ message: GENERIC });
  });
});
