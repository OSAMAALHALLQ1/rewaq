import { describe, expect, it } from "vitest";
import {
  employeeCodeLoginSchema,
  ownerPasswordLoginSchema,
} from "@/lib/validation/access";

describe("password and employee-code login validation", () => {
  it("accepts a valid owner password without requesting an email", () => {
    const parsed = ownerPasswordLoginSchema.parse({ password: "valid-owner-password" });
    expect(parsed).toEqual({ password: "valid-owner-password" });
  });

  it("normalizes employee invite codes without needing a password", () => {
    const parsed = employeeCodeLoginSchema.parse({
      inviteCode: " abcd1234 ",
    });
    expect(parsed).toEqual({ inviteCode: "ABCD1234" });
  });

  it("rejects short owner passwords and invalid employee codes", () => {
    expect(ownerPasswordLoginSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(employeeCodeLoginSchema.safeParse({ inviteCode: "12" }).success).toBe(false);
  });
});
