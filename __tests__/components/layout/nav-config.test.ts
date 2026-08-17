import { describe, expect, it } from "vitest";
import {
  canViewNavItem,
  navigationGroupsForRole,
  type NavItem,
} from "@/components/layout/nav-config";
import type { Role } from "@/types/domain";

function visibleItems(role: Role, planCode: string): NavItem[] {
  return navigationGroupsForRole(role).flatMap((group) =>
    group.items.filter((item) => canViewNavItem(item, role, planCode)),
  );
}

describe("role and plan navigation", () => {
  it("keeps the owner navigation focused on management rather than the operational ledger", () => {
    const items = visibleItems("organization_owner", "scale");
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain("/dashboard/accounting/p-and-l");
    expect(hrefs).toContain("/dashboard/branches");
    expect(hrefs).toContain("/dashboard/settings/users");
    expect(hrefs).not.toContain("/dashboard/accounting/ledger");
    expect(hrefs).not.toContain("/dashboard/accounting/journal");
  });

  it("opens the digital menu from growth based on its entitlement without a price badge", () => {
    const growthItem = visibleItems("organization_owner", "growth").find(
      (item) => item.href === "/dashboard/digital-presence",
    );
    const starterItem = visibleItems("organization_owner", "starter").find(
      (item) => item.href === "/dashboard/digital-presence",
    );

    expect(growthItem).toMatchObject({ title: "المنيو والموقع" });
    expect(growthItem?.badge).toBeUndefined();
    expect(starterItem).toBeUndefined();
  });

  it("shows accountants accounting routes but not inventory routes", () => {
    const hrefs = visibleItems("accountant", "scale").map((item) => item.href);

    expect(hrefs).toContain("/dashboard/accounting");
    expect(hrefs).toContain("/dashboard/accounting/ledger");
    expect(hrefs).not.toContain("/dashboard/inventory");
  });

  it("intersects an inventory employee role with the selected plan", () => {
    expect(visibleItems("inventory_manager", "starter")).toEqual([]);

    const growthHrefs = visibleItems("inventory_manager", "growth").map(
      (item) => item.href,
    );
    expect(growthHrefs).toContain("/dashboard/inventory/dashboard");
    expect(growthHrefs).toContain("/dashboard/stock-counts");
    expect(growthHrefs).not.toContain("/dashboard/accounting");
  });

  it("shows Tikka waiter, tables, KDS, and Expo navigation from growth only", () => {
    const starterHrefs = visibleItems("branch_manager", "starter").map(
      (item) => item.href,
    );
    const growthHrefs = visibleItems("branch_manager", "growth").map(
      (item) => item.href,
    );
    const tikkaHrefs = ["/dashboard/tables", "/d/waiter", "/d/kitchen", "/d/expo"];

    expect(starterHrefs).toContain("/d/pos");
    for (const href of tikkaHrefs) {
      expect(starterHrefs).not.toContain(href);
      expect(growthHrefs).toContain(href);
    }
  });

  it("keeps the marketing manager focused on digital presence without social publishing", () => {
    const growthHrefs = visibleItems("marketing_manager", "growth").map(
      (item) => item.href,
    );
    const scaleHrefs = visibleItems("marketing_manager", "scale").map(
      (item) => item.href,
    );

    expect(growthHrefs).toEqual(["/dashboard/digital-presence"]);
    expect(scaleHrefs).toEqual(["/dashboard/digital-presence"]);
  });
});
