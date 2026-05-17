import { NextResponse } from "next/server";
import { createCustomerInvoiceSvgImage } from "@/lib/invoice-image";
import { getCustomerInvoice, getOrganizationContext } from "@/server/queries/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, context] = await Promise.all([getCustomerInvoice(id), getOrganizationContext()]);

  if (!invoice) {
    return new NextResponse("الفاتورة غير موجودة", { status: 404 });
  }

  const svg = createCustomerInvoiceSvgImage(invoice, context.organization.name);
  const filename = `${invoice.invoiceNumber}.svg`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
