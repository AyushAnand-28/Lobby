import { describe, expect, it } from "vitest";

import { loginSchema, signupSchema } from "@/lib/validation/auth";

const validSignup = {
  displayName: "Vivek",
  email: "vivek@example.com",
  phone: "",
  password: "shuttle99",
  confirmPassword: "shuttle99",
};

describe("loginSchema", () => {
  it("normalises email casing and surrounding whitespace", () => {
    const result = loginSchema.parse({
      email: "  Vivek@Example.COM  ",
      password: "anything",
    });
    expect(result.email).toBe("vivek@example.com");
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "vivek@", password: "x" });
    expect(result.success).toBe(false);
  });

  it("does not apply the password policy at login", () => {
    // A pre-existing account may have a password that predates the rule; the
    // login form must not refuse to submit it.
    const result = loginSchema.safeParse({ email: "a@b.com", password: "old" });
    expect(result.success).toBe(true);
  });
});

describe("signupSchema", () => {
  it("accepts a well formed signup", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("treats an empty phone as absent", () => {
    const result = signupSchema.parse(validSignup);
    expect(result.phone).toBeUndefined();
  });

  it("keeps a phone number that was provided", () => {
    const result = signupSchema.parse({ ...validSignup, phone: "+91 98765 43210" });
    expect(result.phone).toBe("+91 98765 43210");
  });

  it.each([
    ["too short", "shut9"],
    ["letters only", "shuttlecock"],
    ["digits only", "998877665"],
  ])("rejects a password that is %s", (_label, password) => {
    const result = signupSchema.safeParse({
      ...validSignup,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
  });

  it("reports a mismatch against the confirm field, not the password field", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "shuttle98",
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("confirmPassword");
    expect(paths).not.toContain("password");
  });
});
