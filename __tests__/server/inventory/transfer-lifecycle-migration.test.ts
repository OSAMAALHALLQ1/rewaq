import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/060_inventory_transfer_lifecycle.sql"),
  "utf8",
);

describe("060 inventory transfer lifecycle", () => {
  it("models the full lifecycle and segregation of duties", () => {
    for (const status of ["draft", "pending_approval", "approved", "in_transit", "received", "variance_review", "closed", "cancelled"]) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).toContain("لا يجوز لمنشئ التحويل أو مرسله اعتماده");
  });

  it("moves source stock on ship and destination stock on receipt", () => {
    const ship = sql.indexOf("p_action = 'ship'");
    const receive = sql.indexOf("create or replace function public.receive_inventory_transfer_atomic");
    expect(ship).toBeGreaterThan(0);
    expect(receive).toBeGreaterThan(ship);
    expect(sql.slice(ship, receive)).toContain("quantity=quantity-v_line.requested_quantity");
    expect(sql.slice(receive)).toContain("quantity=quantity+v_input.received_quantity");
  });

  it("is retry-safe, audited, service-role only, and prevents deletion", () => {
    expect(sql).toContain("transfers_org_idempotency_unique");
    expect(sql).toContain("inventory_transfer_received");
    expect(sql).toContain("prevent_transfer_delete");
    expect(sql).toContain("revoke all on function public.receive_inventory_transfer_atomic");
    expect(sql).toContain("grant execute on function public.receive_inventory_transfer_atomic");
  });
});
