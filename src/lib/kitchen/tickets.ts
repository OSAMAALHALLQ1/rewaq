import "server-only";

type SupabaseAdmin = any;

export type KitchenTicketLine = {
  catalogItemId: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
};

export async function createKitchenTicketForInvoice(
  admin: SupabaseAdmin,
  input: {
    organizationId: string;
    branchId: string;
    invoiceId: string;
    shiftId?: string | null;
    invoiceNumber: string;
    customerName: string;
    channel?: string;
    notes?: string | null;
    lines: KitchenTicketLine[];
  },
) {
  const kitchenLines = input.lines.filter((line) => Boolean(line.menuItemId));

  if (kitchenLines.length === 0) {
    return null;
  }

  const { data: existing, error: existingError } = await admin
    .from("kitchen_tickets")
    .select("id, ticket_number")
    .eq("organization_id", input.organizationId)
    .eq("customer_invoice_id", input.invoiceId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const ticketNumber = `KDS-${input.invoiceNumber.replace(/^POS-/, "").slice(0, 22)}`;
  const { data: ticket, error: ticketError } = await admin
    .from("kitchen_tickets")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      customer_invoice_id: input.invoiceId,
      shift_id: input.shiftId ?? null,
      ticket_number: ticketNumber,
      customer_name: input.customerName || "عميل",
      channel: input.channel ?? "pickup",
      status: "pending",
      priority: "normal",
      notes: input.notes ?? null,
    })
    .select("id, ticket_number")
    .single();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "تعذر إنشاء تذكرة المطبخ.");
  }

  const { error: itemsError } = await admin.from("kitchen_ticket_items").insert(
    kitchenLines.map((line) => ({
      organization_id: input.organizationId,
      kitchen_ticket_id: ticket.id,
      menu_item_id: line.menuItemId,
      catalog_item_id: line.catalogItemId,
      name: line.name,
      quantity: line.quantity,
      status: "pending",
    })),
  );

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return ticket;
}
