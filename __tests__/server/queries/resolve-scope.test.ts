/**
 * Tenant isolation tests for resolveScope.
 *
 * These prove that a user is never silently scoped to "the first organization"
 * in the database. Doing so would leak another tenant's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => {
  return {
    currentUserId: "user-A",
    demoModeEnabled: false,
  };
});

vi.mock("@/lib/supabase/env", () => ({
  hasSupabaseEnv: () => true,
  hasSupabaseAdminEnv: () => true,
  canUseDemoFallback: () => false,
  isDemoModeEnabled: () => hoisted.demoModeEnabled,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: hoisted.currentUserId } } }),
    },
  }),
  createServerClient: () => ({}),
}));

import { resolveScope } from "@/server/queries/_shared/utils";
import { demoOrganization } from "@/lib/demo-data";

function makeAdmin(responseMap: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: (_table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "delete", "eq", "neq", "in", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve(responseMap[_table] ?? { data: null, error: null });
      builder.single = () => Promise.resolve(responseMap[_table] ?? { data: null, error: null });
      return builder;
    },
  };
}

describe("resolveScope tenant isolation", () => {
  beforeEach(() => {
    hoisted.currentUserId = "user-A";
    hoisted.demoModeEnabled = false;
  });

  it("returns the user's membership organization, never the first organization", async () => {
    hoisted.currentUserId = "user-A";

    const admin = makeAdmin({
      organization_memberships: {
        data: { organization_id: "org-A", branch_id: "branch-A" },
        error: null,
      },
      // Even if a malicious/incorrect "first org" existed, it must not be used.
      organizations: { data: { id: "org-FIRST" }, error: null },
    });

    const scope = await resolveScope(admin as any);

    expect(scope.organizationId).toBe("org-A");
    expect(scope.organizationId).not.toBe("org-FIRST");
  });

  it("throws a clear error when the user has no valid membership (production)", async () => {
    hoisted.currentUserId = "user-A";
    hoisted.demoModeEnabled = false;

    const admin = makeAdmin({
      organization_memberships: { data: null, error: null },
      organizations: { data: { id: "org-FIRST" }, error: null },
    });

    await expect(resolveScope(admin as any)).rejects.toThrow(/مؤسسة/);
  });

  it("scopes strictly to the isolated demo organization in demo mode", async () => {
    hoisted.currentUserId = "user-A";
    hoisted.demoModeEnabled = true;

    const admin = makeAdmin({
      organization_memberships: { data: null, error: null },
      organizations: { data: { id: demoOrganization.id }, error: null },
    });

    const scope = await resolveScope(admin as any);

    expect(scope.organizationId).toBe(demoOrganization.id);
    expect(scope.organizationId).not.toBe("org-FIRST");
  });
});
