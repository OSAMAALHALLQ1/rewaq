import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  signAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth/admin-token";
import { createDemoTrialToken } from "@/lib/auth/demo-trial";

const savedSecret = process.env.INTERNAL_ADMIN_SECRET;

beforeEach(() => {
  process.env.INTERNAL_ADMIN_SECRET = "test-admin-secret-that-is-longer-than-32-characters";
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.INTERNAL_ADMIN_SECRET;
  else process.env.INTERNAL_ADMIN_SECRET = savedSecret;
});

describe("admin session token isolation", () => {
  it("accepts only an admin token with the required claims", async () => {
    const token = await signAdminSessionToken("admin");
    await expect(verifyAdminSessionToken(token)).resolves.toEqual({
      role: "super_admin",
      username: "admin",
    });
  });

  it("never accepts a signed demo ticket as an admin session", async () => {
    const demoToken = await createDemoTrialToken();
    expect(demoToken).toBeTruthy();
    await expect(verifyAdminSessionToken(demoToken!)).resolves.toBeNull();
  });

  it("rejects same-secret JWTs that omit issuer, audience, or role", async () => {
    const key = new TextEncoder().encode(process.env.INTERNAL_ADMIN_SECRET!);
    const token = await new SignJWT({ username: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyAdminSessionToken(token)).resolves.toBeNull();
  });
});
