import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/058_purchase_order_partial_receiving_lifecycle.sql"),
  "utf8",
);

describe("عقد migration 058 للمشتريات", () => {
  it("يمرر قيد الاستلام عبر المسار المحاسبي المركزي داخل RPC نفسه", () => {
    expect(migration).toContain("public.post_balanced_journal_atomic(");
    expect(migration).not.toMatch(/insert\s+into\s+public\.journal_entries/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.journal_lines/i);
    expect(migration).toContain("if v_inventory_total > 0 then");
    expect(migration).toContain("'input_tax_receivable'");
    expect(migration).toContain("'goods_received_not_invoiced'");
  });

  it("يحمي إعادة المحاولة بمفتاح مؤسسي وبصمة حمولة", () => {
    expect(migration).toContain("goods_receipts_org_idempotency_unique");
    expect(migration).toContain("purchase_orders_org_idempotency_unique");
    expect(migration).toContain("request_fingerprint");
    expect(migration).toContain("أعيد استخدام مفتاح الاستلام ببيانات مختلفة");
    expect(migration).toContain("أعيد استخدام مفتاح أمر الشراء ببيانات مختلفة");
  });

  it("يفصل بين الإرسال والاعتماد ويمنع اعتماد المستخدم لمعاملته", () => {
    expect(migration).toContain("submit_purchase_order_atomic");
    expect(migration).toContain("approve_purchase_order_atomic");
    expect(migration).toContain("if v_order.submitted_by = p_actor_user_id then");
    expect(migration).toContain("لا يجوز لمُرسل أمر الشراء اعتماد معاملته بنفسه");
  });

  it("يزيد المخزون للكميات المقبولة فقط ويحفظ تفاصيل الرفض والدفعة والموقع", () => {
    expect(migration).toContain("if v_accepted > 0 then");
    expect(migration).toContain("set quantity = round(quantity + v_accepted, 4)");
    expect(migration).toContain("rejected_quantity");
    expect(migration).toContain("rejection_reason");
    expect(migration).toContain("batch_number");
    expect(migration).toContain("expiry_date");
    expect(migration).toContain("destination_location");
  });

  it("يقصر القراءة على القسم والكتابة على RPC الخدمة", () => {
    expect(migration).toContain("purchase_order_items branch read");
    expect(migration).toContain("goods_receipts_branch_select");
    expect(migration).toContain("goods_receipt_items_branch_select");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("prevent_purchasing_history_delete");
  });
});
