"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Settings, AlertCircle, Check, Loader2, Info, ToggleLeft, ToggleRight, Sliders, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveAccountingSettingsAction } from "@/server/actions/accounting";
import type { AccountingSettings } from "@/server/queries/accounting-erp";

function CustomSwitch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between p-4 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div className="space-y-0.5 pe-4">
        <Label className="text-sm font-bold text-slate-800 cursor-pointer" onClick={() => onChange(!checked)}>{label}</Label>
        {description && <p className="text-[10px] text-slate-500 leading-4">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="text-slate-600 hover:text-teal-600 transition"
      >
        {checked ? (
          <ToggleRight className="h-7 w-7 text-teal-600" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-slate-350" />
        )}
      </button>
    </div>
  );
}

export function SettingsClient({ initialSettings }: { initialSettings: AccountingSettings }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Settings states
  const [currencyCode, setCurrencyCode] = React.useState(initialSettings.currencyCode);
  const [taxEnabled, setTaxEnabled] = React.useState(initialSettings.taxEnabled);
  const [taxRate, setTaxRate] = React.useState(initialSettings.taxRate.toString());
  const [allowNegativeStock, setAllowNegativeStock] = React.useState(initialSettings.allowNegativeStock);
  const [requireShiftBeforeSale, setRequireShiftBeforeSale] = React.useState(initialSettings.requireShiftBeforeSale);
  const [requireManagerApprovalRefund, setRequireManagerApprovalRefund] = React.useState(initialSettings.requireManagerApprovalRefund);
  const [discountApprovalLimit, setDiscountApprovalLimit] = React.useState(initialSettings.discountApprovalLimit.toString());
  const [lockPostedInvoices, setLockPostedInvoices] = React.useState(initialSettings.lockPostedInvoices);
  const [enableBranches, setEnableBranches] = React.useState(initialSettings.enableBranches);
  const [enableCostCenters, setEnableCostCenters] = React.useState(initialSettings.enableCostCenters);
  const [enableAdvancedAccounting, setEnableAdvancedAccounting] = React.useState(initialSettings.enableAdvancedAccounting);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData();
    formData.append("currencyCode", currencyCode);
    formData.append("taxEnabled", taxEnabled.toString());
    formData.append("taxRate", taxRate);
    formData.append("allowNegativeStock", allowNegativeStock.toString());
    formData.append("requireShiftBeforeSale", requireShiftBeforeSale.toString());
    formData.append("requireManagerApprovalRefund", requireManagerApprovalRefund.toString());
    formData.append("discountApprovalLimit", discountApprovalLimit);
    formData.append("lockPostedInvoices", lockPostedInvoices.toString());
    formData.append("enableBranches", enableBranches.toString());
    formData.append("enableCostCenters", enableCostCenters.toString());
    formData.append("enableAdvancedAccounting", enableAdvancedAccounting.toString());

    startTransition(async () => {
      try {
        const res = await saveAccountingSettingsAction({ ok: false, message: "" }, formData);
        if (!res.ok) {
          setFormError(res.message);
        } else {
          setFormSuccess(res.message);
          setTimeout(() => {
            setFormSuccess(null);
          }, 2000);
          router.refresh();
        }
      } catch (err) {
        setFormError("حدث خطأ أثناء حفظ الإعدادات، حاول مرة أخرى.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right max-w-4xl mx-auto" dir="rtl">
      {formError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-bold">{formError}</p>
        </div>
      )}
      {formSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm text-green-800">
          <Check className="h-5 w-5 shrink-0" />
          <p className="font-bold">{formSuccess}</p>
        </div>
      )}

      {/* Security Admin Note */}
      <Card className="backdrop-blur-md bg-amber-50/40 border border-amber-200/50 shadow-sm rounded-2xl p-4">
        <div className="flex gap-2.5 items-start">
          <Shield className="h-5 w-5 text-amber-650 shrink-0 mt-0.5" />
          <p className="text-xs leading-6 text-slate-650">
            <strong>صفحة إدارية حساسة:</strong> تعديل هذه الإعدادات يؤثر مباشرة على سير العمل والبيع التلقائي والترحيل. التغييرات تتطلب صلاحيات مالك المؤسسة (Owner) أو مدير النظام الرئيسي وسجل التعديلات محفوظ بالكامل.
          </p>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales & Stock Settings */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl">
          <CardHeader className="border-b bg-slate-50/50 p-4">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-teal-600" />
              إعدادات المبيعات والمخزون
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400">تعديل سلوكيات الكاشير والمخزن</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <CustomSwitch
              checked={allowNegativeStock}
              onChange={setAllowNegativeStock}
              label="السماح بالبيع بالسالب"
              description="يسمح للكاشير بإنهاء فواتير مبيعات المواد حتى لو لم تكن الكميات متوفرة بالمستودع."
            />
            <CustomSwitch
              checked={requireShiftBeforeSale}
              onChange={setRequireShiftBeforeSale}
              label="إلزام بفتح الوردية قبل البيع"
              description="يمنع الكاشير من سحب الفواتير وإجراء عمليات بيع دون وجود وردية صندوق مفتوحة."
            />
            <CustomSwitch
              checked={requireManagerApprovalRefund}
              onChange={setRequireManagerApprovalRefund}
              label="طلب موافقة المدير على المرتجعات"
              description="يجبر الكاشير على طلب كود أو موافقة المسؤول لإجراء فاتورة مرتجع مبيعات."
            />
            <div className="space-y-1.5 p-3 border rounded-xl bg-slate-50/30">
              <Label htmlFor="discountApprovalLimit" className="text-xs font-bold text-slate-500">حد الخصم الأقصى المسموح للموظف</Label>
              <Input
                id="discountApprovalLimit"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountApprovalLimit}
                onChange={(e) => setDiscountApprovalLimit(e.target.value)}
                className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
              />
              <p className="text-[9px] text-slate-400">المبلغ الأقصى للخصم قبل طلب موافقة المدير (0 يعني تعطيل القيد).</p>
            </div>
          </CardContent>
        </Card>

        {/* ERP & Tax Settings */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl">
          <CardHeader className="border-b bg-slate-50/50 p-4">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-teal-600" />
              إعدادات الضرائب والمحاسبة الذكية
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400">إدارة الترحيل المتقدم والضرائب العامة</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5 p-3 border rounded-xl bg-slate-50/30">
                <Label htmlFor="currencyCode" className="text-xs font-bold text-slate-500">عملة الحسابات الرئيسية</Label>
                <Select
                  id="currencyCode"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="bg-white border-slate-200 text-right"
                >
                  <option value="ILS">شيكل إسرائيلي (ILS)</option>
                  <option value="JOD">دينار أردني (JOD)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                </Select>
              </div>

              <div className="space-y-1.5 p-3 border rounded-xl bg-slate-50/30">
                <Label htmlFor="taxRate" className="text-xs font-bold text-slate-500">نسبة الضريبة الافتراضية (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0.00"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
                  disabled={!taxEnabled}
                />
              </div>
            </div>

            <CustomSwitch
              checked={taxEnabled}
              onChange={setTaxEnabled}
              label="تفعيل ضريبة المبيعات والتوريد"
              description="تمكين حسابات ضريبة المبيعات المستحقة تلقائياً على كل فاتورة يتم سحبها."
            />
            <CustomSwitch
              checked={lockPostedInvoices}
              onChange={setLockPostedInvoices}
              label="قفل فواتير المشتريات المرحلة"
              description="يمنع تعديل فواتير التوريد بعد ترحيلها محاسبياً لدفتر المخازن."
            />
            <CustomSwitch
              checked={enableBranches}
              onChange={setEnableBranches}
              label="تفعيل المحاسبة متعددة الفروع"
              description="توزيع وربط أسطر القيود ومراكز التكلفة للفروع المختلفة للمؤسسة."
            />
            <CustomSwitch
              checked={enableCostCenters}
              onChange={setEnableCostCenters}
              label="تفعيل مراكز التكلفة العامة"
              description="تفعيل أبعاد ومراكز التكلفة على أسطر القيود والمصروفات."
            />
            <CustomSwitch
              checked={enableAdvancedAccounting}
              onChange={setEnableAdvancedAccounting}
              label="تفعيل المحاسبة الاحترافية (ERP)"
              description="تشغيل لوحة وقيود المحاسبة المزدوجة المتكاملة ودليل الحسابات التلقائي."
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-8 py-3.5 text-sm font-bold shadow-md shadow-teal-500/10 gap-1.5"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ التغييرات العامة
        </Button>
      </div>
    </form>
  );
}
