import { describe, expect, it } from "vitest";
import { employeeCodeLoginSchema } from "@/lib/validation/access";
import { authSchema } from "@/lib/validation/schemas";

describe("password and employee-code login validation", () => {
  it("requires each SaaS owner to use their own email and password", () => {
    const parsed = authSchema.parse({
      email: "owner@example.com",
      password: "valid-owner-password",
    });
    expect(parsed).toEqual({
      email: "owner@example.com",
      password: "valid-owner-password",
    });
  });

  it("normalizes employee invite codes without needing a password", () => {
    const parsed = employeeCodeLoginSchema.parse({
      inviteCode: " rwq-7kmp-3xhf-9qtr-6wyz ",
    });
    expect(parsed).toEqual({ inviteCode: "RWQ-7KMP-3XHF-9QTR-6WYZ" });
  });

  it("rejects owner login without an email and invalid employee codes", () => {
    expect(authSchema.safeParse({ password: "valid-owner-password" }).success).toBe(false);
    expect(employeeCodeLoginSchema.safeParse({ inviteCode: "12" }).success).toBe(false);
  });
});
