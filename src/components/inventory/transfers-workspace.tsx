"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, PackageCheck, Plus, Trash2, Truck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { receiveTransferAction, saveTransferAction, transitionTransferAction } from "@/server/actions/mutations";
import type { Branch, InventoryItem, Transfer } from "@/types/domain";

type DraftLine = { key: string; itemId: string; quantity: string; batchNumber: string; expiryDate: string };
type Props = { transfers: Transfer[]; branches: Branch[]; items: InventoryItem[] };

function newLine(): DraftLine {
  return { key: crypto.randomUUID(), itemId: "", quantity: "1", batchNumber: "", expiryDate: "" };
}

function TransitionForm({ transferId, transition, label }: { transferId: string; transition: string; label: string }) {
  return (
    <ActionForm action={transitionTransferAction} submitLabel={label} className="inline-flex">
      <input type="hidden" name="transferId" value={transferId} />
      <input type="hidden" name="transition" value={transition} />
    </ActionForm>
  );
}

function ReceiptForm({ transfer }: { transfer: Transfer }) {
  const [values, setValues] = useState(() => (transfer.items ?? []).map((item) => ({
    transferItemId: item.id,
    itemName: item.itemName,
    sentQuantity: item.sentQuantity,
    receivedQuantity: String(item.sentQuantity),
    varianceReason: "",
  })));
  return (
    <ActionForm action={receiveTransferAction} submitLabel="تأكيد الاستلام الفعلي" className="space-y-3 rounded-xl border bg-slate-50 p-3">
      <input type="hidden" name="transferId" value={transfer.id} />
      <input type="hidden" name="linesJson" value={JSON.stringify(values)} />
      <p className="text-xs font-bold text-slate-700">المخزون المستقبل لن يزيد إلا بالكميات التالية:</p>
      {values.map((line) => (
        <div key={line.transferItemId} className="grid gap-2 md:grid-cols-[1fr_130px_1fr]">
          <p className="self-center text-sm">{line.itemName} — مشحون {line.sentQuantity}</p>
          <Input type="number" min="0" max={line.sentQuantity} step="0.0001" value={line.receivedQuantity}
            aria-label={`الكمية المستلمة من ${line.itemName}`}
            onChange={(event) => setValues((current) => current.map((item) => item.transferItemId === line.transferItemId ? { ...item, receivedQuantity: event.target.value } : item))} />
          <Input placeholder="سبب الفرق إن وجد" value={line.varianceReason}
            onChange={(event) => setValues((current) => current.map((item) => item.transferItemId === line.transferItemId ? { ...item, varianceReason: event.target.value } : item))} />
        </div>
      ))}
    </ActionForm>
  );
}

export function TransfersWorkspace({ transfers, branches, items }: Props) {
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()]);
  const [idempotencyKey] = useState(() => `transfer:${crypto.randomUUID()}`);
  const payload = useMemo(() => lines.map((line) => ({
    itemId: line.itemId,
    quantity: Number(line.quantity),
    sourceWarehouse: "general",
    destinationWarehouse: "general",
    batchNumber: line.batchNumber || undefined,
    expiryDate: line.expiryDate || undefined,
  })), [lines]);

  return (
    <div className="space-y-5" dir="rtl">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />طلب تحويل متعدد المواد</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={saveTransferAction} submitLabel="حفظ مسودة التحويل" className="space-y-4">
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <input type="hidden" name="linesJson" value={JSON.stringify(payload)} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="fromBranchId">القسم المرسل</Label><Select id="fromBranchId" name="fromBranchId" required><option value="">اختر القسم</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="toBranchId">القسم المستقبل</Label><Select id="toBranchId" name="toBranchId" required><option value="">اختر القسم</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table><TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>الكمية المطلوبة</TableHead><TableHead>رقم الدفعة</TableHead><TableHead>الصلاحية</TableHead><TableHead>إزالة</TableHead></TableRow></TableHeader>
                <TableBody>{lines.map((line) => <TableRow key={line.key}>
                  <TableCell><Select value={line.itemId} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, itemId: event.target.value } : item))} required><option value="">اختر المادة</option>{items.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></TableCell>
                  <TableCell><Input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, quantity: event.target.value } : item))} required /></TableCell>
                  <TableCell><Input value={line.batchNumber} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, batchNumber: event.target.value } : item))} /></TableCell>
                  <TableCell><Input type="date" value={line.expiryDate} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, expiryDate: event.target.value } : item))} /></TableCell>
                  <TableCell><Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>)}</TableBody></Table>
            </div>
            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, newLine()])}>إضافة مادة</Button>
            <div className="grid gap-2"><Label htmlFor="notes">ملاحظات</Label><Input id="notes" name="notes" /></div>
          </ActionForm>
        </CardContent>
      </Card>

      {transfers.map((transfer) => (
        <Card key={transfer.id}>
          <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-3"><span>{transfer.transferNumber ?? transfer.id}</span><StatusBadge status={transfer.status} /></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">من {transfer.fromBranchName} إلى {transfer.toBranchName} — {transfer.totalItems} مواد</p>
            {(transfer.items ?? []).length > 0 && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{transfer.items?.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><p className="font-bold">{item.itemName}</p><p>مطلوب {item.requestedQuantity} · مشحون {item.sentQuantity} · مستلم {item.receivedQuantity}</p>{item.varianceQuantity ? <p className="text-amber-700">فرق {item.varianceQuantity}: {item.varianceReason || "بانتظار السبب"}</p> : null}</div>)}</div>}
            <div className="flex flex-wrap gap-2">
              {transfer.status === "draft" && <TransitionForm transferId={transfer.id} transition="submit" label="إرسال للاعتماد" />}
              {transfer.status === "pending_approval" && <TransitionForm transferId={transfer.id} transition="approve" label="اعتماد التحويل" />}
              {transfer.status === "approved" && <TransitionForm transferId={transfer.id} transition="ship" label="شحن وخصم من المرسل" />}
              {transfer.status === "in_transit" && <span className="inline-flex items-center gap-2 text-sm text-blue-700"><Truck className="h-4 w-4" />بالطريق؛ لم يدخل مخزون المستقبل بعد.</span>}
              {(transfer.status === "received" || transfer.status === "variance_review") && <TransitionForm transferId={transfer.id} transition="close" label="إغلاق التحويل" />}
            </div>
            {transfer.status === "in_transit" && <ReceiptForm transfer={transfer} />}
            {transfer.status === "closed" && <p className="flex items-center gap-2 text-sm text-emerald-700"><PackageCheck className="h-4 w-4" />أُغلق التحويل بعد تثبيت الكميات والفروقات.</p>}
            {(["draft", "pending_approval", "approved"] as string[]).includes(transfer.status) && <ActionForm action={transitionTransferAction} submitLabel="إلغاء قبل الشحن" className="grid gap-2 md:grid-cols-[1fr_auto]"><input type="hidden" name="transferId" value={transfer.id} /><input type="hidden" name="transition" value="cancel" /><Input name="reason" placeholder="سبب الإلغاء" required /></ActionForm>}
          </CardContent>
        </Card>
      ))}
      {transfers.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><ArrowLeftRight className="mx-auto mb-3 h-8 w-8" />لا توجد تحويلات بعد.</CardContent></Card>}
    </div>
  );
}
