import { describe, expect, it } from "vitest";

import { formatDateRange } from "@/lib/tournament/dates";

describe("formatDateRange", () => {
  it("returns null when no dates are set", () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it("formats a single day, whichever end is set", () => {
    expect(formatDateRange("2026-10-12", null)).toBe("12 Oct 2026");
    expect(formatDateRange(null, "2026-10-12")).toBe("12 Oct 2026");
    expect(formatDateRange("2026-10-12", "2026-10-12")).toBe("12 Oct 2026");
  });

  it("drops the repeated year within a year and keeps it across one", () => {
    expect(formatDateRange("2026-10-12", "2026-10-14")).toBe("12 Oct - 14 Oct 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 - 2 Jan 2027");
  });

  it("does not shift the first of the month into the previous one", () => {
    // Parsed as local midnight, this would read 30 Sep west of UTC.
    expect(formatDateRange("2026-10-01", null)).toBe("1 Oct 2026");
  });
});
