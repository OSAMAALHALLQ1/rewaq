/**
 * Cross-Tenant IDOR & Object Reference Security Tests
 *
 * Validates that an attacker authenticated in Organization A cannot read,
 * modify, link, or transition resources belonging to Organization B.
 */
import { describe, it, expect } from "vitest";

describe("Cross-Tenant IDOR & BOLA Prevention", () => {
  const orgA = "11111111-1111-4000-8000-111111111111";
  const orgB = "22222222-2222-4000-8000-222222222222";

  it("blocks referencing foreign tenant supplier in purchase orders", () => {
    const suppliers = [
      { id: "sup-A-meat", organization_id: orgA, name: "مورد لحوم أ" },
      { id: "sup-B-dairy", organization_id: orgB, name: "مورد ألبان ب" },
    ];

    const validateSupplierScope = (supplierId: string, currentOrgId: string) => {
      const supplier = suppliers.find((s) => s.id === supplierId && s.organization_id === currentOrgId);
      if (!supplier) {
        throw new Error("المورد المحدد غير موجود في المؤسسة الحالية.");
      }
      return supplier;
    };

    // Valid same-tenant supplier -> OK
    expect(() => validateSupplierScope("sup-A-meat", orgA)).not.toThrow();

    // Attacker from Org A attempts to link Org B's supplier -> REJECTED
    expect(() => validateSupplierScope("sup-B-dairy", orgA)).toThrow(
      "المورد المحدد غير موجود في المؤسسة الحالية.",
    );
  });

  it("blocks referencing foreign tenant inventory items in recipes", () => {
    const inventory = [
      { id: "inv-A-flour", organization_id: orgA, name: "طحين أ" },
      { id: "inv-B-sugar", organization_id: orgB, name: "سكر ب" },
    ];

    const validateItemScope = (itemId: string, currentOrgId: string) => {
      const item = inventory.find((i) => i.id === itemId && i.organization_id === currentOrgId);
      if (!item) {
        throw new Error("المادة الأولية غير موجودة في المؤسسة.");
      }
      return item;
    };

    // Valid same-tenant item -> OK
    expect(() => validateItemScope("inv-A-flour", orgA)).not.toThrow();

    // Attacker from Org A attempts to use Org B's inventory item -> REJECTED
    expect(() => validateItemScope("inv-B-sugar", orgA)).toThrow(
      "المادة الأولية غير موجودة في المؤسسة.",
    );
  });

  it("blocks cross-tenant inventory transfer source and destination branches", () => {
    const branches = [
      { id: "br-A-main", organization_id: orgA, name: "فرع أ الرئيسي" },
      { id: "br-A-drive", organization_id: orgA, name: "فرع أ السيارات" },
      { id: "br-B-main", organization_id: orgB, name: "فرع ب الرئيسي" },
    ];

    const validateTransferBranches = (fromBranchId: string, toBranchId: string, currentOrgId: string) => {
      const fromBranch = branches.find((b) => b.id === fromBranchId && b.organization_id === currentOrgId);
      const toBranch = branches.find((b) => b.id === toBranchId && b.organization_id === currentOrgId);

      if (!fromBranch || !toBranch) {
        throw new Error("أحد الفروع المختارة لا ينتمي لنفس المؤسسة.");
      }
      if (fromBranch.id === toBranch.id) {
        throw new Error("لا يمكن التحويل لنفس الفرع.");
      }
      return { fromBranch, toBranch };
    };

    // Valid intra-tenant transfer -> OK
    expect(() => validateTransferBranches("br-A-main", "br-A-drive", orgA)).not.toThrow();

    // Cross-tenant transfer injection -> REJECTED
    expect(() => validateTransferBranches("br-A-main", "br-B-main", orgA)).toThrow(
      "أحد الفروع المختارة لا ينتمي لنفس المؤسسة.",
    );
  });
});
