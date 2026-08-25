import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  hasSupabaseAdminEnv: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  hasSupabaseAdminEnv: mocks.hasSupabaseAdminEnv,
}));

import { withPlatformAdmin } from "@/server/queries/_shared/platform-admin";

describe("withPlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ role: "super_admin", username: "admin" });
    mocks.hasSupabaseAdminEnv.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ source: "service-role" });
  });

  it("loads platform data for a verified platform-admin session without a tenant scope", async () => {
    const loader = vi.fn().mockResolvedValue({ organizations: 2 });

    await expect(withPlatformAdmin(loader)).resolves.toEqual({ organizations: 2 });

    expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith({ source: "service-role" });
  });

  it("denies direct access before creating a service-role client", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("Unauthorized"));
    const loader = vi.fn();

    await expect(withPlatformAdmin(loader)).rejects.toThrow("Unauthorized");

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(loader).not.toHaveBeenCalled();
  });

  it("fails closed when the platform database credentials are unavailable", async () => {
    mocks.hasSupabaseAdminEnv.mockReturnValue(false);

    await expect(withPlatformAdmin(vi.fn())).rejects.toThrow(
      "Supabase admin environment is required for platform administration.",
    );

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
