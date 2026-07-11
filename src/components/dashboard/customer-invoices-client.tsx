"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Search, Trash2, ShoppingCart, Calculator } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer } from "@/components/ui/drawer";
import { formatCurrency } from "@/lib/utils";
import { issueCustomerInvoiceAction } from "@/server/actions/mutations";
import type { CustomerInvoice, Branch, CatalogItem } from "@/types/domain";

type CustomerInvoicesClientProps = {
  invoices: CustomerInvoice[];
  branches: Branch[];
  catalogItems: CatalogItem[];
};

const PAYMENT_METHODS = [
  { id: "cash", label: "نقدي" },
  { id: "card", label: "بطاقة" },
  { id: "bank_transfer", label: "حوالة بنكية" },
  { id: "wallet", label: "محفظة إلكترونية" },
  { id: "receivable", label: "ذمم عملاء (آجل)" },
  { id: "delivery_app", label: "تطبيق توصيل" },
];

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "حوالة",
  delivery_app: "تطبيق توصيل",
  receivable: "ذمم عملاء",
  wallet: "المحفظة الإلكترونية",
  gift_card: "بطاقة هدايا",
};

type FormItem = {
  catalog_item_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  name: string;
};

export function CustomerInvoicesClient({ invoices, branches, catalogItems }: CustomerInvoicesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");

  // Form State
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [customerName, setCustomerName] = useState("عميل سفري سريع");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [notes, setNotes] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Add Item to Form
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);

  const handleAddItem = () => {
    if (!selectedCatalogId) return;
    const catalog = catalogItems.find((c) => c.id === selectedCatalogId);
    if (!catalog) return;

    // Check if item already added
    const existingIndex = formItems.findIndex((item) => item.catalog_item_id === selectedCatalogId);
    if (existingIndex > -1) {
      const updated = [...formItems];
      updated[existingIndex].quantity += selectedQty;
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          catalog_item_id: catalog.id,
          quantity: selectedQty,
          unit_price: Number(catalog.retailPrice || 0),
          discount: 0,
          tax_rate: Number(catalog.taxRate || 0),
          name: catalog.name,
        },
      ]);
    }

    setSelectedCatalogId("");
    setSelectedQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Math calculations
  const subtotal = formItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const itemsTax = formItems.reduce((sum, item) => sum + (item.unit_price * item.quantity) * (item.tax_rate / 100), 0);
  const total = Math.max(subtotal - invoiceDiscount + itemsTax + serviceFee + deliveryFee, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (formItems.length === 0) {
      setErrorMsg("يجب إضافة صنف واحد على الأقل للفاتورة.");
      return;
    }

    startTransition(async () => {
      const res = await issueCustomerInvoiceAction({
        organizationId: "00000000-0000-0000-0000-000000000000", // Will be resolved server side
        branchId,
        customerName,
        customerPhone: customerPhone || null,
        paymentMethod: paymentMethod as any,
        channel: "pickup",
        items: formItems.map(item => ({
          catalog_item_id: item.catalog_item_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_rate: item.tax_rate,
        })),
        invoiceDiscount,
        serviceFee,
        deliveryFee,
        notes: notes || null,
        allowNegativeStock: true, // Allow fallback or RLS rules
      });

      if (res.ok) {
        setDrawerOpen(false);
        // Reset form
        setFormItems([]);
        setCustomerName("عميل سفري سريع");
        setCustomerPhone("");
        setInvoiceDiscount(0);
        setServiceFee(0);
        setDeliveryFee(0);
        setNotes("");
        router.refresh();
      } else {
        setErrorMsg(res.message || "حدث خطأ أثناء حفظ الفاتورة.");
      }
    });
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customerName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = selectedBranchFilter === "all" || inv.branchId === selectedBranchFilter;
    return matchesSearch && matchesBranch;
  });

  return (
    <>
      <PageHeader
        title="فواتير العملاء"
        description="إصدار فواتير البيع وإدارتها بشكل لحظي وسريع دون مغادرة الصفحة."
        actions={
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" />
            فاتورة جديدة
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              سجل فواتير العملاء
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full max-w-72">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  placeholder="بحث برقم الفاتورة أو العميل"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                className="max-w-60"
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
              >
                <option value="all">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>المجموع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>طباعة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    <div>{invoice.customerName}</div>
                    {invoice.customerPhone && (
                      <p className="text-xs text-muted-foreground">{invoice.customerPhone}</p>
                    )}
                  </TableCell>
                  <TableCell>{invoice.branchName}</TableCell>
                  <TableCell>{paymentLabels[invoice.paymentMethod] || invoice.paymentMethod}</TableCell>
                  <TableCell>{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/print/customer-invoices/${invoice.id}`} target="_blank" rel="noopener noreferrer">
                        <Printer className="h-4 w-4" />
                        طباعة
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    لا توجد فواتير مطابقة للبحث.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer لإنشاء الفاتورة الجديدة */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="إصدار فاتورة مبيعات جديدة"
        description="تسجيل مبيعات الكاشير وإصدار فاتورة ذرياً وخصم المخزون"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={isPending}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "جاري الحفظ..." : "إصدار وحفظ الفاتورة"}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMsg && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">الفرع المالي</label>
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">طريقة السداد</label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">اسم العميل</label>
              <Input
                placeholder="عميل سفري سريع"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">رقم الهاتف (اختياري)</label>
              <Input
                placeholder="059XXXXXXX"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* إضافة صنف جديد */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <ShoppingCart className="h-4 w-4 text-primary" />
              إضافة أصناف للفاتورة
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label className="mb-1 block text-[10px] font-bold text-muted-foreground">اختر الصنف</label>
                <Select value={selectedCatalogId} onChange={(e) => setSelectedCatalogId(e.target.value)}>
                  <option value="">-- اختر الصنف --</option>
                  {catalogItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatCurrency(c.retailPrice || 0)})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-24">
                <label className="mb-1 block text-[10px] font-bold text-muted-foreground">الكمية</label>
                <Input
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value)))}
                />
              </div>

              <Button type="button" variant="secondary" onClick={handleAddItem}>
                إضافة
              </Button>
            </div>
          </div>

          {/* سلة الأصناف المضافة */}
          <div>
            <h3 className="mb-2 text-sm font-bold text-foreground">الأصناف المحددة</h3>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>المجموع</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(item.unit_price * item.quantity)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {formItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                        لم يتم إضافة أي أصناف بعد.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* الحسابات والرسوم */}
          <div className="rounded-xl border border-border bg-slate-50/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              الرسوم والخصومات المحتسبة
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold text-muted-foreground">الخصم العام (₪)</label>
                <Input
                  type="number"
                  min="0"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-muted-foreground">رسوم الخدمة (₪)</label>
                <Input
                  type="number"
                  min="0"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(Math.max(0, Number(e.target.value)))}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold text-muted-foreground">رسوم التوصيل (₪)</label>
                <Input
                  type="number"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            <div className="mt-4 border-t border-dashed border-border pt-4 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>المجموع الفرعي:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الضريبة المضافة:</span>
                <span>{formatCurrency(itemsTax)}</span>
              </div>
              {invoiceDiscount > 0 && (
                <div className="flex justify-between text-xs text-destructive font-bold">
                  <span>الخصم المطبق:</span>
                  <span>-{formatCurrency(invoiceDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-foreground border-t border-border pt-2">
                <span>الإجمالي النهائي (₪):</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">ملاحظات الفاتورة</label>
            <Input
              placeholder="اكتب أي ملاحظات متعلقة بالفاتورة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Drawer>
    </>
  );
}
