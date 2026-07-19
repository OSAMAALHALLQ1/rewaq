import { describe, expect, it, vi } from "vitest";

import { postBalancedJournal, reverseJournalEntry } from "@/lib/accounting/posting";

function balancedInput() {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    sourceDocType: "integrity_test",
    sourceDocId: "33333333-3333-4333-8333-333333333333",
    memo: "اختبار سلامة القيد",
    entryDate: "2026-07-15",
    createdBy: "44444444-4444-4444-8444-444444444444",
    lines: [
      { accountId: "55555555-5555-4555-8555-555555555555", debit: 25, memo: "مدين" },
      { systemKey: "cash_on_hand", credit: 25, memo: "دائن" },
    ],
  };
}

function atomicAdmin(result: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: vi.fn(async () => result),
    from: vi.fn(() => {
      throw new Error("Direct journal table writes are forbidden");
    }),
  };
}

describe("accounting posting integrity", () => {
  it("posts the complete balanced journal through one atomic RPC", async () => {
    const admin = atomicAdmin({ data: { entry_id: "entry-1", duplicate: false }, error: null });

    await expect(
      postBalancedJournal(admin as unknown as Parameters<typeof postBalancedJournal>[0], balancedInput()),
    ).resolves.toBe("entry-1");

    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("post_balanced_journal_atomic", {
      p_organization_id: "11111111-1111-4111-8111-111111111111",
      p_branch_id: "22222222-2222-4222-8222-222222222222",
      p_source_doc_type: "integrity_test",
      p_source_doc_id: "33333333-3333-4333-8333-333333333333",
      p_memo: "اختبار سلامة القيد",
      p_entry_date: "2026-07-15",
      p_lines: [
        {
          system_key: null,
          account_id: "55555555-5555-4555-8555-555555555555",
          debit: 25,
          credit: 0,
          memo: "مدين",
          cost_center_id: null,
        },
        {
          system_key: "cash_on_hand",
          account_id: null,
          debit: 0,
          credit: 25,
          memo: "دائن",
          cost_center_id: null,
        },
      ],
      p_created_by: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("accepts an idempotent duplicate returned by the posting RPC", async () => {
    const admin = atomicAdmin({ data: { entry_id: "entry-existing", duplicate: true }, error: null });

    await expect(
      postBalancedJournal(admin as unknown as Parameters<typeof postBalancedJournal>[0], balancedInput()),
    ).resolves.toBe("entry-existing");
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rejects an unbalanced journal before touching the database", async () => {
    const admin = atomicAdmin({ data: null, error: null });
    const input = balancedInput();
    input.lines[1].credit = 24;

    await expect(
      postBalancedJournal(admin as unknown as Parameters<typeof postBalancedJournal>[0], input),
    ).rejects.toThrow("القيد غير متوازن");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("propagates an atomic posting failure without attempting repair deletes", async () => {
    const admin = atomicAdmin({ data: null, error: { message: "يوجد قيد draft قديم غير مكتمل لهذا المستند." } });

    await expect(
      postBalancedJournal(admin as unknown as Parameters<typeof postBalancedJournal>[0], balancedInput()),
    ).rejects.toThrow("draft قديم");
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("creates the reversal through one atomic RPC in the supplied open period", async () => {
    const admin = atomicAdmin({ data: { entry_id: "reversal-1", duplicate: false }, error: null });

    await expect(
      reverseJournalEntry(admin as unknown as Parameters<typeof reverseJournalEntry>[0], {
        organizationId: "11111111-1111-4111-8111-111111111111",
        entryId: "66666666-6666-4666-8666-666666666666",
        reason: " تصحيح تصنيف الحساب ",
        entryDate: "2026-07-18",
        createdBy: "44444444-4444-4444-8444-444444444444",
      }),
    ).resolves.toBe("reversal-1");

    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("reverse_journal_entry_atomic", {
      p_organization_id: "11111111-1111-4111-8111-111111111111",
      p_entry_id: "66666666-6666-4666-8666-666666666666",
      p_reason: "تصحيح تصنيف الحساب",
      p_reversal_date: "2026-07-18",
      p_created_by: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("rejects a reversal without a meaningful reason before the database call", async () => {
    const admin = atomicAdmin({ data: null, error: null });

    await expect(
      reverseJournalEntry(admin as unknown as Parameters<typeof reverseJournalEntry>[0], {
        organizationId: "11111111-1111-4111-8111-111111111111",
        entryId: "66666666-6666-4666-8666-666666666666",
        reason: "لا",
      }),
    ).rejects.toThrow("سبب العكس مطلوب");
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
