/**
 * Demo account restrictions.
 */
import { describe, it, expect, afterEach } from "vitest";

const saved = process.env.RAWAQ_DEMO_EMAIL;

describe("isDemoUserEmail", () => {
  afterEach(() => {
    if (saved === undefined) delete process.env.RAWAQ_DEMO_EMAIL;
    else process.env.RAWAQ_DEMO_EMAIL = saved;
  });

  it("returns false when no demo email is configured", async () => {
    delete process.env.RAWAQ_DEMO_EMAIL;
    const { isDemoUserEmail } = await import("@/server/actions/auth");
    expect(isDemoUserEmail("someone@example.com")).toBe(false);
  });

  it("matches only the configured demo email (case-insensitive)", async () => {
    process.env.RAWAQ_DEMO_EMAIL = "demo@rewaq.local";
    const { isDemoUserEmail } = await import("@/server/actions/auth");
    expect(isDemoUserEmail("demo@rewaq.local")).toBe(true);
    expect(isDemoUserEmail("DEMO@rewaq.local")).toBe(true);
    expect(isDemoUserEmail("owner@example.com")).toBe(false);
    expect(isDemoUserEmail(null)).toBe(false);
    expect(isDemoUserEmail(undefined)).toBe(false);
  });
});
