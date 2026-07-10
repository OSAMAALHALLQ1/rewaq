"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SOURCE_DOC_LABELS } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { JournalBrowserData } from "@/server/queries/accounting-erp";

export function JournalBrowserClient({ data }: { data: JournalBrowserData }) {
  const router = useRouter();
  const [from, setFrom] = React.useState(data.filter.from || "");
  const [to, setTo] = React.useState(data.filter.to || "");
  const [q, setQ] = React.useState(data.filter.q || "");
  const [status, setStatus] = React.useState(data.filter.status || "");
  const [sourceType, setSourceType] = React.useState(data.filter.sourceType || "");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const navigate = () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (sourceType) params.set("sourceType", sourceType);
    router.push(`/dashboard/accounting/journal?${params.toString()}`);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Filters */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate();
          }}
          className="grid gap-4 lg:grid-cols-6 items-end"
        >
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="journalSearch" className="text-xs font-bold text-slate-500">بحث (رقم القيد، البيان، الحساب)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="journalSearch"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="JE-2026... أو نص البيان"
                className="pe-3 ps-9 bg-white border-slate-200 rounded-lg text-right"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="journalFrom" className="text-xs font-bold text-slate-500">من تاريخ</Label>
            <Input id="journalFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white border-slate-200 rounded-lg text-right font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journalTo" className="text-xs font-bold text-slate-500">إلى تاريخ</Label>
            <Input id="journalTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white border-slate-200 rounded-lg text-right font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journalSource" className="text-xs font-bold text-slate-500">نوع المستند</Label>
            <Select id="journalSource" value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="bg-white border-slate-200 text-right">
              <option value="">الكل</option>
              {data.sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {SOURCE_DOC_LABELS[type] || type}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-white border-slate-200 text-right" aria-label="الحالة">
              <option value="">كل الحالات</option>
              <option value="posted">مرحّل</option>
              <option value="draft">مسودة</option>
            </Select>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold gap-1">
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/accounting/journal")}
              className="border-slate-200 hover:bg-slate-50 rounded-lg"
              title="إعادة تعيين"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>

      {data.truncated && (
        <Card className="backdrop-blur-md bg-amber-50/50 border border-amber-200/60 shadow-sm rounded-2xl p-4">
          <div className="flex gap-2.5 items-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 font-bold">تم عرض أحدث 200 قيد فقط. ضيّق نطاق التاريخ لمراجعة كاملة.</p>
          </div>
        </Card>
      )}

      {/* Totals strip */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="bg-white/80 border border-slate-200/50 rounded-xl px-4 py-2 font-bold text-slate-600">
          عدد القيود المعروضة: <span className="font-mono text-slate-900">{data.entries.length}</span>
        </div>
        <div className="bg-white/80 border border-slate-200/50 rounded-xl px-4 py-2 font-bold text-slate-600">
          إجمالي المدين: <span className="font-mono text-slate-900">{formatCurrency(data.totalDebit)}</span>
        </div>
        <div className="bg-white/80 border border-slate-200/50 rounded-xl px-4 py-2 font-bold text-slate-600">
          إجمالي الدائن: <span className="font-mono text-slate-900">{formatCurrency(data.totalCredit)}</span>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {data.entries.length === 0 ? (
          <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-12 text-center text-slate-400 text-sm">
            لا توجد قيود مطابقة للفلاتر المحددة
          </Card>
        ) : (
          data.entries.map((entry) => {
            const isOpen = expanded.has(entry.id);
            return (
              <Card key={entry.id} className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(entry.id)}
                  className="w-full text-right p-4 flex flex-wrap items-center gap-3 hover:bg-slate-50/40 transition-colors"
                >
                  <span className="text-slate-400">{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
                  <span className="font-mono text-xs font-bold text-slate-700 w-36">{entry.entryNumber}</span>
                  <span className="font-mono text-xs text-slate-500 w-24">{entry.entryDate}</span>
                  <Badge tone={entry.status === "posted" ? "success" : "warning"} className="rounded-lg px-2 py-0.5 text-[10px]">
                    {entry.status === "posted" ? "مرحّل" : "مسودة"}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2 py-1">
                    {SOURCE_DOC_LABELS[entry.sourceDocType || ""] || "قيد يدوي"}
                  </span>
                  {!entry.balanced && (
                    <Badge tone="danger" className="rounded-lg px-2 py-0.5 text-[10px]">غير متزن!</Badge>
                  )}
                  <span className="flex-1 text-xs text-slate-600 font-medium truncate">{entry.memo || "-"}</span>
                  <span className="font-mono text-xs font-black text-teal-700">{formatCurrency(entry.debitTotal)}</span>
                </button>

                {isOpen && (
                  <CardContent className="p-0 border-t">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-slate-50/50 text-slate-400 border-b">
                          <TableHead className="text-right py-2.5 px-5 font-bold">الحساب</TableHead>
                          <TableHead className="text-right py-2.5 px-5 font-bold">البيان</TableHead>
                          <TableHead className="text-right py-2.5 px-5 font-bold w-32">مركز التكلفة</TableHead>
                          <TableHead className="text-left py-2.5 px-5 font-bold w-28">مدين</TableHead>
                          <TableHead className="text-left py-2.5 px-5 font-bold w-28">دائن</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.lines.map((line) => (
                          <TableRow key={line.id} className="hover:bg-slate-50/30">
                            <TableCell className="py-2.5 px-5 text-slate-800 font-bold">
                              <span className="font-mono text-slate-400 me-1">{line.accountCode}</span>
                              {line.accountName}
                            </TableCell>
                            <TableCell className="py-2.5 px-5 text-slate-600">{line.memo || "-"}</TableCell>
                            <TableCell className="py-2.5 px-5 text-slate-500">{line.costCenterName || "-"}</TableCell>
                            <TableCell className="text-left py-2.5 px-5 font-mono text-slate-800">{line.debit > 0 ? formatCurrency(line.debit) : "-"}</TableCell>
                            <TableCell className="text-left py-2.5 px-5 font-mono text-slate-800">{line.credit > 0 ? formatCurrency(line.credit) : "-"}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50/60 font-bold border-t">
                          <TableCell colSpan={3} className="py-2.5 px-5 text-slate-700">
                            الإجمالي
                            {entry.branchName && <span className="text-[10px] text-slate-400 font-normal ms-3">فرع: {entry.branchName}</span>}
                            {entry.reversalOfEntryId && <span className="text-[10px] text-rose-500 font-normal ms-3">قيد عكسي لقيد سابق</span>}
                          </TableCell>
                          <TableCell className="text-left py-2.5 px-5 font-mono text-teal-700 font-black">{formatCurrency(entry.debitTotal)}</TableCell>
                          <TableCell className="text-left py-2.5 px-5 font-mono text-teal-700 font-black">{formatCurrency(entry.creditTotal)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
