import { describe, expect, it } from "vitest";

import {
  buildLoginPath,
  DEFAULT_REDIRECT,
  safeNextPath,
} from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/dashboard/tournaments/abc")).toBe(
      "/dashboard/tournaments/abc",
    );
  });

  it("keeps the query string and hash", () => {
    expect(safeNextPath("/dashboard?tab=teams#top")).toBe("/dashboard?tab=teams#top");
  });

  it.each([undefined, null, "", "   "])("falls back for %p", (input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_REDIRECT);
  });

  describe("open redirect defences", () => {
    it.each([
      ["absolute http url", "http://evil.com/steal"],
      ["absolute https url", "https://evil.com/steal"],
      ["protocol relative", "//evil.com"],
      ["backslash protocol relative", "/\\evil.com"],
      ["backslash prefix", "\\\\evil.com"],
      ["scheme without slashes", "javascript:alert(1)"],
      ["data uri", "data:text/html,<script>alert(1)</script>"],
      ["relative escape", "../../etc/passwd"],
    ])("rejects %s", (_label, input) => {
      expect(safeNextPath(input)).toBe(DEFAULT_REDIRECT);
    });

    it("rejects embedded control characters used to smuggle a host", () => {
      expect(safeNextPath("/\t//evil.com")).toBe(DEFAULT_REDIRECT);
      expect(safeNextPath("/\n//evil.com")).toBe(DEFAULT_REDIRECT);
      expect(safeNextPath("/\u0000dashboard")).toBe(DEFAULT_REDIRECT);
    });
  });

  describe("loop defences", () => {
    it.each(["/login", "/signup", "/login?next=/login", "/auth/callback"])(
      "rejects %s so the visitor is not bounced back to auth",
      (input) => {
        expect(safeNextPath(input)).toBe(DEFAULT_REDIRECT);
      },
    );

    it("does not reject paths that merely start with an auth prefix", () => {
      expect(safeNextPath("/loginhelp")).toBe("/loginhelp");
    });
  });
});

describe("buildLoginPath", () => {
  it("omits next when the destination is already the default", () => {
    expect(buildLoginPath("/dashboard")).toBe("/login");
  });

  it("preserves a deeper intended destination", () => {
    expect(buildLoginPath("/dashboard/settings")).toBe(
      "/login?next=%2Fdashboard%2Fsettings",
    );
  });

  it("does not propagate a hostile destination", () => {
    expect(buildLoginPath("https://evil.com")).toBe("/login");
  });
});
