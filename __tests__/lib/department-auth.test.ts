/**
 * Department device auth: capability/branch scoping and demo fail-closed gating.
 */
import { describe, it, expect, afterEach } from "vitest";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

function makeDevice(overrides: Partial<{
  role: string;
  branchId: string | null;
  organizationId: string;
  allowedModules: string[];
}> = {}) {
  return {
    ok: true as const,
    admin: null as any,
    device: {
      id: "dev-1",
      organizationId: overrides.organizationId ?? "org-1",
      branchId: overrides.branchId ?? "branch-1",
      role: overrides.role ?? "cashier",
      deviceName: "test",
      allowedModules: overrides.allowedModules ?? ["pos"],
    },
  };
}

function makeDeviceNullableBranch(role: string, branchId: string | null) {
  return {
    ok: true as const,
    admin: null as any,
    device: {
      id: "dev-1",
      organizationId: "org-1",
      branchId,
      role,
      deviceName: "test",
      allowedModules: ["pos", "recipes", "inventory"],
    },
  };
}

describe("requireDepartmentDeviceCapability", () => {
  it("allows when role is permitted and branch matches", async () => {
    const { requireDepartmentDeviceCapability } = await import("@/lib/department/auth");
    const auth = makeDevice({ role: "cashier", branchId: "branch-1" });
    const result = requireDepartmentDeviceCapability(auth, "pos_write", "branch-1");
    expect(result.ok).toBe(true);
  });

  it("denies when role is not permitted (manager-only capability)", async () => {
    const { requireDepartmentDeviceCapability } = await import("@/lib/department/auth");
    const auth = makeDevice({ role: "cashier" });
    const result = requireDepartmentDeviceCapability(auth, "pos_refund", "branch-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("denies when device branch does not match the target branch", async () => {
    const { requireDepartmentDeviceCapability } = await import("@/lib/department/auth");
    const auth = makeDevice({ role: "manager", branchId: "branch-1" });
    const result = requireDepartmentDeviceCapability(auth, "pos_write", "branch-2");
    expect(result.ok).toBe(false);
  });

  it("denies when a device has no branch but a target branch is required", async () => {
    const { requireDepartmentDeviceCapability } = await import("@/lib/department/auth");
    const auth = makeDeviceNullableBranch("chef", null);
    const result = requireDepartmentDeviceCapability(auth, "kitchen_write", "branch-1");
    expect(result.ok).toBe(false);
  });
});

describe("Supabase env gating (fail-closed)", () => {
  it("hasSupabaseEnv requires both url and publishable key", async () => {
    const { hasSupabaseEnv } = await import("@/lib/supabase/env");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(hasSupabaseEnv()).toBe(false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(hasSupabaseEnv()).toBe(false);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk";
    expect(hasSupabaseEnv()).toBe(true);
  });

  it("isDemoModeEnabled is false in production even when RAWAQ_DEMO_MODE=true", async () => {
    const { isDemoModeEnabled } = await import("@/lib/supabase/env");
    process.env.RAWAQ_DEMO_MODE = "true";
    (process.env as any).NODE_ENV = "production";
    expect(isDemoModeEnabled()).toBe(false);
    (process.env as any).NODE_ENV = "test";
    expect(isDemoModeEnabled()).toBe(true);
  });

  it("canUseDemoFallback is false when service role key is present (no demo masking of real env)", async () => {
    const { canUseDemoFallback } = await import("@/lib/supabase/env");
    process.env.RAWAQ_DEMO_MODE = "true";
    (process.env as any).NODE_ENV = "test";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(canUseDemoFallback()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(canUseDemoFallback()).toBe(false);
  });
});
