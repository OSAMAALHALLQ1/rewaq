"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveStockCountAction } from "@/server/actions/mutations";

type StockCountWorkspaceProps = {
  items: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  branchStock: Array<{ branchId: string; itemId: string; quantity: number }>;
  countedAt: string;
};

export function StockCountWorkspace({ items, branches, branchStock, countedAt }: StockCountWorkspaceProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [idempotencyKey] = useState(() => `stock-count:${crypto.randomUUID()}`);
  const quantities = useMemo(() => {
    const byItem = new Map<string, number>();
    branchStock.filter((stock) => stock.branchId === branchId).forEach((stock) => {
      byItem.set(stock.itemId, (byItem.get(stock.itemId) ?? 0) + stock.quantity);
    });
    return byItem;
  }, [branchId, branchStock]);

  return (
    <Card>
      <CardHeader><CardTitle>بنود الجرد</CardTitle></CardHeader>
      <CardContent>
        <ActionForm action={saveStockCountAction} submitLabel="اعتماد الجرد" className="space-y-4">
          <input type="hidden" name="countedAt" value={countedAt} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div className="grid gap-2">
            <Label htmlFor="branchId">الفرع</Label>
            <Select id="branchId" name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>المادة</TableHead><TableHead>النظام</TableHead><TableHead>العد الفعلي</TableHead><TableHead>الفرق</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((item) => {
                const systemQuantity = quantities.get(item.id) ?? 0;
                return <TableRow key={`${branchId}:${item.id}`}>
                  <TableCell className="font-medium">{item.name}<input type="hidden" name="itemId" value={item.id} /></TableCell>
                  <TableCell>{systemQuantity}</TableCell>
                  <TableCell><Input className="max-w-28" name="countedQuantity" type="number" min="0" step="0.0001" defaultValue={systemQuantity} /></TableCell>
                  <TableCell><Badge tone="muted">يُحسب عند الاعتماد</Badge></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
          <div className="grid gap-2"><Label htmlFor="notes">ملاحظات الجرد</Label><Textarea id="notes" name="notes" /></div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
