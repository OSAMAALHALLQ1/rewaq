import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDemoTrialToken,
  DEMO_TRIAL_HOURS,
  isDemoTrialTokenValid,
} from "@/lib/auth/demo-trial";

describe("demo trial ticket", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("cannot sign a ticket without the secret and does not enforce the window", async () => {
    vi.stubEnv("INTERNAL_ADMIN_SECRET", "");
    await expect(createDemoTrialToken()).resolves.toBeNull();
    await expect(isDemoTrialTokenValid(undefined)).resolves.toBe(true);
  });

  it("accepts a freshly signed ticket and rejects a missing or tampered one", async () => {
    vi.stubEnv("INTERNAL_ADMIN_SECRET", "test-secret-for-demo-trial");
    const token = await createDemoTrialToken();

    expect(token).toBeTruthy();
    await expect(isDemoTrialTokenValid(token as string)).resolves.toBe(true);
    await expect(isDemoTrialTokenValid(undefined)).resolves.toBe(false);
    await expect(isDemoTrialTokenValid(`${token}x`)).resolves.toBe(false);
  });

  it("rejects the ticket after the 8-hour window passes", async () => {
    vi.stubEnv("INTERNAL_ADMIN_SECRET", "test-secret-for-demo-trial");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:00:00Z"));

    const token = await createDemoTrialToken();
    await expect(isDemoTrialTokenValid(token as string)).resolves.toBe(true);

    vi.setSystemTime(new Date("2026-07-17T15:59:00Z"));
    await expect(isDemoTrialTokenValid(token as string)).resolves.toBe(true);

    vi.setSystemTime(new Date("2026-07-17T16:01:00Z"));
    await expect(isDemoTrialTokenValid(token as string)).resolves.toBe(false);
    expect(DEMO_TRIAL_HOURS).toBe(8);
  });
});
