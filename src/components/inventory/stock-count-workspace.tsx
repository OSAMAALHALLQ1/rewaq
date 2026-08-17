"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createStockCountSessionAction,
  postStockCountSessionAction,
  saveStockCountProgressAction,
  transitionStockCountSessionAction,
} from "@/server/actions/stock-counts";
import type { StockCountSummary } from "@/server/queries/inventory";

type StockCountWorkspaceProps = {
  branches: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  counts: StockCountSummary[];
  selectedCountId?: string;
  countedAt: string;
  canApprove: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  counting: "العد الأول",
  review: "مراجعة الفروقات",
  recount: "إعادة العد",
  pending_approval: "بانتظار الاعتماد",
  approved: "معتمد — بانتظار الترحيل",
  posted: "مرحّل",
  closed: "مغلق",
  cancelled: "ملغي",
};

const WAREHOUSE_LABELS: Record<string, string> = {
  all: "كل المخزون",
  general: "المخزن العام",
  kitchen: "مخزن المطبخ",
};

function toneForStatus(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "closed" || status === "posted") return "success";
  if (status === "cancelled") return "danger";
  if (status === "counting" || status === "recount" || status === "review") return "warning";
  return "muted";
}

export function StockCountWorkspace({
  branches,
  categories,
  counts,
  selectedCountId,
  countedAt,
  canApprove,
}: StockCountWorkspaceProps) {
  const [idempotencyKey] = useState(() => `stock-count-session:${crypto.randomUUID()}`);
  const selected = counts.find((count) => count.id === selectedCountId) ?? counts.find((count) =>
    ["counting", "review", "recount", "pending_approval", "approved", "posted"].includes(count.status),
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>بدء جلسة جرد جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createStockCountSessionAction} className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <div className="grid gap-2">
              <Label htmlFor="branchId">القسم</Label>
              <Select id="branchId" name="branchId" required>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="countedAt">تاريخ المستند</Label>
              <Input id="countedAt" name="countedAt" type="date" defaultValue={countedAt} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="warehouse">نطاق المخزن</Label>
              <Select id="warehouse" name="warehouse" defaultValue="all">
                <option value="all">كل المخزون</option>
                <option value="general">المخزن العام</option>
                <option value="kitchen">مخزن المطبخ</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">الفئة (اختياري)</Label>
              <Select id="categoryId" name="categoryId" defaultValue="">
                <option value="">كل الفئات</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="varianceApprovalThreshold">حد تنبيه قيمة الفروقات</Label>
              <Input id="varianceApprovalThreshold" name="varianceApprovalThreshold" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold">
              <input name="blindCount" type="checkbox" defaultChecked />
              جرد أعمى: لا تظهر كمية النظام أثناء العد
            </label>
            <div className="grid gap-2 lg:col-span-2">
              <Label htmlFor="notes">ملاحظات ونطاق الجرد</Label>
              <Textarea id="notes" name="notes" maxLength={1000} />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit">إنشاء لقطة وبدء العد</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? `جلسة ${selected.countNumber}` : "تفاصيل جلسة الجرد"}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                أنشئ جلسة جرد لالتقاط كميات النظام ثم ابدأ العد.
              </p>
            ) : (
              <SessionWorkspace count={selected} canApprove={canApprove} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>سجل جلسات الجرد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {counts.length === 0 ? (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">لا توجد جلسات بعد.</p>
            ) : counts.map((count) => (
              <Link
                key={count.id}
                href={`/dashboard/stock-counts?session=${count.id}`}
                className={`block rounded-xl border p-4 transition hover:border-primary ${selected?.id === count.id ? "border-primary bg-primary-light" : "bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{count.countNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{count.branchName} · {WAREHOUSE_LABELS[count.warehouse] ?? count.warehouse}</p>
                  </div>
                  <Badge tone={toneForStatus(count.status)}>{STATUS_LABELS[count.status] ?? count.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-lg bg-slate-50 p-2">مواد: {count.itemsCount}</span>
                  <span className="rounded-lg bg-slate-50 p-2">فروقات: {count.varianceCount}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionWorkspace({ count, canApprove }: { count: StockCountSummary; canApprove: boolean }) {
  const isFirstCount = count.status === "counting";
  const isRecount = count.status === "recount";
  const isBlindStage = count.blindCount && (isFirstCount || isRecount);
  const entryLines = isRecount ? count.lines.filter((line) => line.countState === "recount_required") : count.lines;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toneForStatus(count.status)}>{STATUS_LABELS[count.status] ?? count.status}</Badge>
        <Badge tone="muted">{count.branchName}</Badge>
        <Badge tone="muted">{WAREHOUSE_LABELS[count.warehouse] ?? count.warehouse}</Badge>
        {count.blindCount ? <Badge tone="warning">جرد أعمى</Badge> : null}
      </div>

      {(isFirstCount || isRecount) ? (
        <ActionForm action={saveStockCountProgressAction} className="space-y-4">
          <input type="hidden" name="stockCountId" value={count.id} />
          <input type="hidden" name="mode" value={isRecount ? "recount" : "first"} />
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المادة</TableHead>
                  {!isBlindStage ? <TableHead>كمية النظام</TableHead> : null}
                  <TableHead>{isRecount ? "العد المستقل الثاني" : "العد الفعلي"}</TableHead>
                  <TableHead>سبب الفرق (اختياري)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-semibold">
                      {line.itemName}
                      <input type="hidden" name="itemId" value={line.itemId} />
                    </TableCell>
                    {!isBlindStage ? <TableCell>{line.systemQuantity}</TableCell> : null}
                    <TableCell>
                      <Input
                        name="quantity"
                        type="number"
                        min="0"
                        step="0.0001"
                        defaultValue={isRecount ? line.secondCountQuantity ?? "" : line.firstCountQuantity ?? ""}
                        className="min-w-28"
                        required
                      />
                    </TableCell>
                    <TableCell>
                      <Input name="varianceReason" defaultValue={line.varianceReason ?? ""} className="min-w-44" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="submitStage" value="no" variant="outline">حفظ التقدم</Button>
            <Button type="submit" name="submitStage" value="yes">حفظ وإنهاء المرحلة</Button>
          </div>
        </ActionForm>
      ) : null}

      {count.status === "review" ? (
        <ActionForm action={transitionStockCountSessionAction} className="space-y-4">
          <input type="hidden" name="stockCountId" value={count.id} />
          <VarianceTable count={count} selectable />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="transition" value="request_recount" variant="outline">طلب إعادة عد المحدد</Button>
            <Button type="submit" name="transition" value="submit_review">قبول المراجعة وإرسال للاعتماد</Button>
          </div>
        </ActionForm>
      ) : null}

      {["pending_approval", "approved", "posted", "closed"].includes(count.status) ? <VarianceTable count={count} /> : null}

      {count.status === "pending_approval" && canApprove ? (
        <ActionForm action={transitionStockCountSessionAction}>
          <input type="hidden" name="stockCountId" value={count.id} />
          <Button type="submit" name="transition" value="approve">اعتماد الجلسة</Button>
        </ActionForm>
      ) : null}

      {count.status === "pending_approval" && !canApprove ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">بانتظار مدير القسم أو مالك المؤسسة للاعتماد.</p>
      ) : null}

      {count.status === "approved" && canApprove ? (
        <ActionForm action={postStockCountSessionAction}>
          <input type="hidden" name="stockCountId" value={count.id} />
          <input type="hidden" name="idempotencyKey" value={`stock-count-post:${count.id}`} />
          <Button type="submit">ترحيل الفروقات للمخزون والمحاسبة</Button>
        </ActionForm>
      ) : null}

      {count.status === "posted" && canApprove ? (
        <ActionForm action={transitionStockCountSessionAction}>
          <input type="hidden" name="stockCountId" value={count.id} />
          <Button type="submit" name="transition" value="close" variant="outline">إغلاق الجلسة</Button>
        </ActionForm>
      ) : null}

      {["counting", "review", "recount", "pending_approval"].includes(count.status) && canApprove ? (
        <ActionForm action={transitionStockCountSessionAction}>
          <input type="hidden" name="stockCountId" value={count.id} />
          <Button type="submit" name="transition" value="cancel" variant="destructive">إلغاء قبل الترحيل</Button>
        </ActionForm>
      ) : null}
    </div>
  );
}

function VarianceTable({ count, selectable = false }: { count: StockCountSummary; selectable?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable ? <TableHead>إعادة عد</TableHead> : null}
            <TableHead>المادة</TableHead>
            <TableHead>لقطة النظام</TableHead>
            <TableHead>العد النهائي</TableHead>
            <TableHead>الفرق</TableHead>
            <TableHead>السبب</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {count.lines.map((line) => {
            const finalQuantity = line.countedQuantity ?? line.secondCountQuantity ?? line.firstCountQuantity;
            const variance = finalQuantity === null ? null : finalQuantity - line.systemQuantity;
            return (
              <TableRow key={line.id}>
                {selectable ? (
                  <TableCell>
                    {variance !== 0 ? <input type="checkbox" name="recountItemId" value={line.itemId} defaultChecked /> : "—"}
                  </TableCell>
                ) : null}
                <TableCell className="font-semibold">{line.itemName}</TableCell>
                <TableCell>{line.systemQuantity}</TableCell>
                <TableCell>{finalQuantity ?? "—"}</TableCell>
                <TableCell><Badge tone={variance === 0 ? "success" : "warning"}>{variance ?? "—"}</Badge></TableCell>
                <TableCell>{line.varianceReason ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
