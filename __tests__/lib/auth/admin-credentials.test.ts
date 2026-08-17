import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adminClientFingerprint,
  checkAdminLoginRateLimit,
  recordAdminLoginResult,
  resetAdminLoginRateLimitsForTests,
  verifyConfiguredAdminCredentials,
} from "@/lib/auth/admin-credentials";

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env.INTERNAL_ADMIN_USERNAME = "admin";
  process.env.INTERNAL_ADMIN_PASSWORD = "a-long-random-test-password";
  resetAdminLoginRateLimitsForTests();
});

afterEach(() => {
  process.env = { ...savedEnv };
  resetAdminLoginRateLimitsForTests();
});

describe("internal admin credentials", () => {
  it("verifies only server-configured credentials", () => {
    expect(
      verifyConfiguredAdminCredentials("admin", "a-long-random-test-password"),
    ).toBe(true);
    expect(verifyConfiguredAdminCredentials("admin", "wrong-password")).toBe(false);
    expect(verifyConfiguredAdminCredentials("other", "a-long-random-test-password")).toBe(false);
  });

  it("locks a client temporarily after repeated failures", () => {
    const fingerprint = "client-a";
    const now = 1_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordAdminLoginResult(fingerprint, false, now + attempt);
    }

    expect(checkAdminLoginRateLimit(fingerprint, now + 10).allowed).toBe(false);
    expect(checkAdminLoginRateLimit(fingerprint, now + 16 * 60 * 1000).allowed).toBe(true);
  });

  it("clears failures after a valid login", () => {
    recordAdminLoginResult("client-b", false, 1_000);
    recordAdminLoginResult("client-b", true, 2_000);
    expect(checkAdminLoginRateLimit("client-b", 3_000).allowed).toBe(true);
  });

  it("fingerprints client metadata without retaining raw addresses", () => {
    const request = new Request("https://example.test/api/admin-auth", {
      headers: {
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "test-browser",
      },
    });
    const fingerprint = adminClientFingerprint(request, "secret");
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.9");
  });
});
