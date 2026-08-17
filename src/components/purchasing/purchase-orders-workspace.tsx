"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import {
  approvePurchaseOrderAction,
  receivePurchaseOrderAction,
  savePurchaseOrderAction,
  submitPurchaseOrderAction,
} from "@/server/actions/mutations";
import type { Branch, InventoryItem, PurchaseOrder, Supplier } from "@/types/domain";

type DraftLine = {
  key: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
};

type ReceiptLine = {
  purchaseOrderItemId: string;
  itemName: string;
  remainingQuantity: number;
  acceptedQuantity: string;
  rejectedQuantity: string;
  rejectionReason: string;
  batchNumber: string;
  expiryDate: string;
  destinationWarehouse: "general" | "kitchen";
  destinationLocation: string;
};

type Props = {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  branches: Branch[];
  items: InventoryItem[];
  today: string;
};

function newDraftLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    itemId: "",
    quantity: "1",
    unitPrice: "0",
    discountAmount: "0",
    taxRate: "0",
  };
}

function quantity(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function approvalBadge(order: PurchaseOrder) {
  const status = order.approvalStatus ?? (order.status === "draft" ? "not_submitted" : "approved");
  if (status === "pending") return <Badge tone="warning">بانتظار الموافقة</Badge>;
  if (status === "approved") return <Badge tone="success">معتمد</Badge>;
  return <Badge tone="muted">غير مرسل</Badge>;
}

export function PurchaseOrdersWorkspace({ purchaseOrders, suppliers, branches, items, today }: Props) {
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => [newDraftLine()]);
  const [shippingAmount, setShippingAmount] = useState("0");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [createIdempotencyKey] = useState(() => `purchase-order:${crypto.randomUUID()}`);
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null);
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([]);
  const [receiptIdempotencyKey, setReceiptIdempotencyKey] = useState("");

  const draftPayload = useMemo(() => draftLines.map((line) => ({
    itemId: line.itemId,
    quantity: quantity(line.quantity),
    unitPrice: quantity(line.unitPrice),
    discountAmount: quantity(line.discountAmount),
    taxRate: quantity(line.taxRate),
  })), [draftLines]);

  const totals = useMemo(() => {
    const subtotal = draftPayload.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discount = draftPayload.reduce((sum, line) => sum + line.discountAmount, 0);
    const tax = draftPayload.reduce((sum, line) => {
      const taxable = Math.max(0, line.quantity * line.unitPrice - line.discountAmount);
      return sum + taxable * line.taxRate / 100;
    }, 0);
    const shipping = quantity(shippingAmount);
    return { subtotal, discount, tax, shipping, total: subtotal - discount + tax + shipping };
  }, [draftPayload, shippingAmount]);

  const updateDraftLine = (key: string, field: keyof Omit<DraftLine, "key">, value: string) => {
    setDraftLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      if (field !== "itemId") return { ...line, [field]: value };
      const selected = items.find((item) => item.id === value);
      return {
        ...line,
        itemId: value,
        unitPrice: line.unitPrice === "0" && selected ? String(selected.lastPurchasePrice) : line.unitPrice,
      };
    }));
  };

  const openReceipt = (order: PurchaseOrder) => {
    setReceiptOrder(order);
    setReceiptIdempotencyKey(`goods-receipt:${crypto.randomUUID()}`);
    setReceiptLines(order.items.map((item) => ({
      purchaseOrderItemId: item.id ?? "",
      itemName: item.itemName,
      remainingQuantity: Math.max(0, item.quantity - item.receivedQuantity),
      acceptedQuantity: String(Math.max(0, item.quantity - item.receivedQuantity)),
      rejectedQuantity: "0",
      rejectionReason: "",
      batchNumber: "",
      expiryDate: "",
      destinationWarehouse: order.destinationWarehouse ?? "general",
      destinationLocation: order.destinationLocation ?? "منطقة الاستلام",
    })));
  };

  const updateReceiptLine = (lineId: string, field: keyof ReceiptLine, value: string) => {
    setReceiptLines((current) => current.map((line) => (
      line.purchaseOrderItemId === lineId ? { ...line, [field]: value } : line
    )));
  };

  const receiptPayload = receiptLines
    .filter((line) => quantity(line.acceptedQuantity) + quantity(line.rejectedQuantity) > 0)
    .map((line) => ({
      purchaseOrderItemId: line.purchaseOrderItemId,
      acceptedQuantity: quantity(line.acceptedQuantity),
      rejectedQuantity: quantity(line.rejectedQuantity),
      rejectionReason: line.rejectionReason || undefined,
      batchNumber: line.batchNumber || undefined,
      expiryDate: line.expiryDate || undefined,
      destinationWarehouse: line.destinationWarehouse,
      destinationLocation: line.destinationLocation,
    }));

  return (
    <div className="space-y-5" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            مسودة أمر شراء متعدد البنود
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={savePurchaseOrderAction} submitLabel="حفظ المسودة" className="space-y-5">
            <input type="hidden" name="idempotencyKey" value={createIdempotencyKey} />
            <input type="hidden" name="itemsJson" value={JSON.stringify(draftPayload)} />
            <input
              type="hidden"
              name="attachmentMetadataJson"
              value={JSON.stringify(attachmentName.trim()
                ? [{ name: attachmentName.trim(), ...(attachmentUrl.trim() ? { url: attachmentUrl.trim() } : {}) }]
                : [])}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierId">المورد</Label>
                <Select id="supplierId" name="supplierId" required>
                  <option value="">اختر المورد</option>
                  {suppliers.filter((supplier) => supplier.status === "active").map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">القسم المستلم</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر القسم</option>
                  {branches.filter((branch) => branch.status === "active").map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="orderDate">تاريخ الأمر</Label>
                <Input id="orderDate" name="orderDate" type="date" defaultValue={today} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expectedDate">التسليم المتوقع</Label>
                <Input id="expectedDate" name="expectedDate" type="date" min={today} defaultValue={today} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="destinationWarehouse">المستودع الوجهة</Label>
                <Select id="destinationWarehouse" name="destinationWarehouse" defaultValue="general" required>
                  <option value="general">المستودع العام</option>
                  <option value="kitchen">مستودع المطبخ</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="destinationLocation">موقع التخزين/الرف</Label>
                <Input id="destinationLocation" name="destinationLocation" placeholder="مثال: منطقة الاستلام - رف A2" required />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="paymentTerms">شروط الدفع</Label>
                <Input id="paymentTerms" name="paymentTerms" placeholder="مثال: صافي 30 يوماً من تاريخ الفاتورة" required />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-52">الصنف</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>سعر الوحدة</TableHead>
                    <TableHead>خصم البند</TableHead>
                    <TableHead>الضريبة %</TableHead>
                    <TableHead>إزالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftLines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        <Select value={line.itemId} onChange={(event) => updateDraftLine(line.key, "itemId", event.target.value)} required>
                          <option value="">اختر الصنف</option>
                          {items.filter((item) => item.isActive).map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell><Input className="min-w-24" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => updateDraftLine(line.key, "quantity", event.target.value)} required /></TableCell>
                      <TableCell><Input className="min-w-28" type="number" min="0" step="0.0001" value={line.unitPrice} onChange={(event) => updateDraftLine(line.key, "unitPrice", event.target.value)} required /></TableCell>
                      <TableCell><Input className="min-w-24" type="number" min="0" step="0.0001" value={line.discountAmount} onChange={(event) => updateDraftLine(line.key, "discountAmount", event.target.value)} /></TableCell>
                      <TableCell><Input className="min-w-20" type="number" min="0" max="100" step="0.0001" value={line.taxRate} onChange={(event) => updateDraftLine(line.key, "taxRate", event.target.value)} /></TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" disabled={draftLines.length === 1} onClick={() => setDraftLines((current) => current.filter((candidate) => candidate.key !== line.key))} aria-label="إزالة البند">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="outline" onClick={() => setDraftLines((current) => [...current, newDraftLine()])}>
              <Plus className="h-4 w-4" /> إضافة بند
            </Button>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="shippingAmount">تكلفة الشحن</Label>
                <Input id="shippingAmount" name="shippingAmount" type="number" min="0" step="0.0001" value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="attachmentName">اسم المرفق (اختياري)</Label>
                <Input id="attachmentName" value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="عرض سعر المورد" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="attachmentUrl">رابط/مسار المرفق (اختياري)</Label>
                <Input id="attachmentUrl" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} type="url" placeholder="https://…" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">ملاحظات التوريد</Label>
              <Textarea id="notes" name="notes" placeholder="تعليمات التسليم أو شروط الفحص" />
            </div>
            <div className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-5">
              <span>قبل الخصم: <b>{formatCurrency(totals.subtotal)}</b></span>
              <span>الخصم: <b>{formatCurrency(totals.discount)}</b></span>
              <span>الضريبة: <b>{formatCurrency(totals.tax)}</b></span>
              <span>الشحن: <b>{formatCurrency(totals.shipping)}</b></span>
              <span>الإجمالي: <b>{formatCurrency(totals.total)}</b></span>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <PackageCheck className="h-4 w-4" />
              حفظ المسودة لا يزيد المخزون ولا ينشئ قيداً؛ الأثر يبدأ عند قبول كميات في إيصال استلام معتمد.
            </p>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            دورة أوامر الشراء والاستلام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأمر / الموعد</TableHead>
                  <TableHead>المورد والوجهة</TableHead>
                  <TableHead>البنود</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="min-w-48">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.length ? purchaseOrders.map((order) => {
                  const canReceive = order.status === "sent" || order.status === "partially_received";
                  const hasReceiptIds = order.items.every((item) => Boolean(item.id));
                  const approvalStatus = order.approvalStatus ?? (order.status === "draft" ? "not_submitted" : "approved");
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-semibold">PO-{order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">{order.orderDate} ← {order.expectedDate ?? "غير محدد"}</div>
                      </TableCell>
                      <TableCell>
                        <div>{order.supplierName}</div>
                        <div className="text-xs text-muted-foreground">{order.branchName} / {order.destinationWarehouse === "kitchen" ? "المطبخ" : "العام"}</div>
                        <div className="text-xs text-muted-foreground">{order.destinationLocation ?? "منطقة الاستلام"}</div>
                      </TableCell>
                      <TableCell className="min-w-56">
                        {order.items.map((item) => (
                          <div key={item.id ?? item.itemId} className="text-sm">
                            {item.itemName}: مقبول {item.receivedQuantity}/{item.quantity}
                            {Number(item.rejectedQuantity ?? 0) > 0 ? <span className="text-destructive"> · مرفوض {item.rejectedQuantity}</span> : null}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(order.total)}
                        <div className="text-[11px] font-normal text-muted-foreground">شحن {formatCurrency(order.shippingTotal ?? 0)}</div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <StatusBadge status={order.status} />
                        <div>{approvalBadge(order)}</div>
                      </TableCell>
                      <TableCell>
                        {order.status === "draft" && approvalStatus !== "pending" ? (
                          <ActionForm action={submitPurchaseOrderAction} submitLabel="إرسال للموافقة">
                            <input type="hidden" name="purchaseOrderId" value={order.id} />
                            <input type="hidden" name="idempotencyKey" value={`po-submit:${order.id}`} />
                          </ActionForm>
                        ) : null}
                        {order.status === "draft" && approvalStatus === "pending" ? (
                          <ActionForm action={approvePurchaseOrderAction} submitLabel="اعتماد وإرسال">
                            <input type="hidden" name="purchaseOrderId" value={order.id} />
                            <input type="hidden" name="idempotencyKey" value={`po-approve:${order.id}`} />
                          </ActionForm>
                        ) : null}
                        {canReceive ? (
                          <Button type="button" size="sm" disabled={!hasReceiptIds} onClick={() => openReceipt(order)}>
                            <ClipboardCheck className="h-4 w-4" /> إدخال استلام جزئي
                          </Button>
                        ) : null}
                        {order.status === "received" ? <span className="text-xs text-emerald-700">مستلم بالكامل</span> : null}
                        {canReceive && !hasReceiptIds ? <span className="block text-xs text-muted-foreground">تفاصيل الاستلام غير متاحة في بيانات العرض التجريبي.</span> : null}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">لا توجد أوامر شراء حتى الآن.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Modal open={receiptOrder !== null} title={`فحص واستلام جزئي — PO-${receiptOrder?.id.slice(0, 8).toUpperCase() ?? ""}`} onClose={() => setReceiptOrder(null)}>
        {receiptOrder ? (
          <ActionForm action={receivePurchaseOrderAction} submitLabel="تسجيل الفحص والاستلام" className="space-y-4">
            <input type="hidden" name="purchaseOrderId" value={receiptOrder.id} />
            <input type="hidden" name="idempotencyKey" value={receiptIdempotencyKey} />
            <input type="hidden" name="linesJson" value={JSON.stringify(receiptPayload)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="receivedAt">تاريخ الاستلام الفعلي</Label>
                <Input id="receivedAt" name="receivedAt" type="date" max={today} defaultValue={today} required />
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 text-xs">
                <div>المورد: <b>{receiptOrder.supplierName}</b></div>
                <div>الوجهة الافتراضية: <b>{receiptOrder.destinationLocation}</b></div>
              </div>
            </div>

            <div className="space-y-4">
              {receiptLines.map((line) => (
                <div key={line.purchaseOrderItemId} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold">{line.itemName}</div>
                    <Badge tone="muted">المتبقي المفتوح: {line.remainingQuantity}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label>الكمية المقبولة</Label>
                      <Input type="number" min="0" max={line.remainingQuantity} step="0.0001" value={line.acceptedQuantity} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "acceptedQuantity", event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>الكمية المرفوضة</Label>
                      <Input type="number" min="0" max={line.remainingQuantity} step="0.0001" value={line.rejectedQuantity} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "rejectedQuantity", event.target.value)} />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>سبب الرفض</Label>
                      <Input value={line.rejectionReason} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "rejectionReason", event.target.value)} placeholder="إلزامي عند وجود كمية مرفوضة" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>رقم التشغيلة</Label>
                      <Input value={line.batchNumber} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "batchNumber", event.target.value)} placeholder="LOT / Batch" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>تاريخ الصلاحية</Label>
                      <Input type="date" min={today} value={line.expiryDate} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "expiryDate", event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>المستودع</Label>
                      <Select value={line.destinationWarehouse} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "destinationWarehouse", event.target.value)}>
                        <option value="general">العام</option>
                        <option value="kitchen">المطبخ</option>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>الموقع/الرف</Label>
                      <Input value={line.destinationLocation} onChange={(event) => updateReceiptLine(line.purchaseOrderItemId, "destinationLocation", event.target.value)} required />
                    </div>
                  </div>
                  {quantity(line.rejectedQuantity) > 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="h-4 w-4" /> الكمية المرفوضة تُسجل للفحص فقط ولا تدخل المخزون أو GRNI.</p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="receiptNotes">ملاحظات الاستلام</Label>
              <Textarea id="receiptNotes" name="notes" placeholder="رقم إذن التسليم، حالة العبوات، أو ملاحظات مسؤول الفحص" />
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              المقبول فقط ينشئ حركة مخزون وقيد مخزون/ضريبة مدخلات مقابل GRNI داخل معاملة واحدة.
            </p>
          </ActionForm>
        ) : null}
      </Modal>
    </div>
  );
}
