import { NextResponse } from "next/server";
import { createInvoiceSvgImage } from "@/lib/invoice-image";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const total = Number(url.searchParams.get("t") ?? 0);
  const invoiceNumber = decodeURIComponent(token).replace(/-+/g, "-");

  const svg = createInvoiceSvgImage({
    invoiceNumber,
    organizationName: "رواق",
    branchName: "فرع البيع السريع",
    customerName: "عميل نقدي",
    issuedAt: new Date().toISOString(),
    total,
    items: [
      {
        id: "quick-sale",
        name: "فاتورة بيع",
        quantity: 1,
        unitPrice: total,
        total,
      },
    ],
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${invoiceNumber}.svg`)}`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
