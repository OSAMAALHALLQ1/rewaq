import { Bell, Building2, Shield, Store, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getOrganizationContext } from "@/server/queries/app";
import { ActionForm } from "@/components/action-form";
import { saveBranchAction } from "@/server/actions/mutations";

export default async function SettingsPage() {
  const { organization, branches } = await getOrganizationContext();

  return (
    <>
      <PageHeader
        title="الإعدادات / الأقسام"
        description="إعدادات المخزن والأقسام الداخلية التي تصرف وتستلم المواد."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                بيانات المخزن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>اسم المؤسسة</Label>
                <Input defaultValue={organization.name} readOnly className="bg-slate-50 cursor-not-allowed" />
              </div>
              <div className="grid gap-2">
                <Label>العملة</Label>
                <Select defaultValue="ILS" disabled className="bg-slate-50 cursor-not-allowed">
                  <option value="ILS">شيكل</option>
                  <option value="USD">دولار</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>طريقة ترقيم فواتير التوريد</Label>
                <Input defaultValue="SUP-{YYYY}-{0000}" readOnly className="bg-slate-50 cursor-not-allowed" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                الأقسام والفرع الحالية
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between rounded-lg border p-3 bg-white">
                  <span className="text-sm font-semibold">{branch.name}</span>
                  <Badge tone={branch.status === "active" ? "success" : "muted"}>
                    {branch.status === "active" ? "مفعل" : "غير مفعل"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                تنبيهات المخزن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["price_increase", "purchase_received", "waste_logged", "expiry_near", "department_order_ready"].map((type) => (
                <label key={type} className="flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked className="accent-primary h-4 w-4" />
                  <span>
                    {type === "price_increase" && "ارتفاع غير متوقع للأسعار (تذبذب الأسعار)"}
                    {type === "purchase_received" && "اعتماد توريد شحنة أو فاتورة جديدة"}
                    {type === "waste_logged" && "تسجيل كميات تالف ومحاريق"}
                    {type === "expiry_near" && "اقتراب موعد انتهاء صلاحية مادة"}
                    {type === "department_order_ready" && "طلب جديد مرسل من الأقسام الداخلية"}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                الأمان وصلاحيات النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>عزل الصفوف (Row Level Security) مفعل بالكامل على جداول كل مؤسسة في قاعدة بيانات Supabase.</p>
              <p>صلاحيات المخزن تفصل بدقة بين اعتماد التوريد، التحويل الداخلي بين الأقسام، وتسجيل الهدر والتالف.</p>
              <p>مفاتيح الخدمة المشفرة تستخدم فقط في المهام السحابية الآمنة لضمان عزل تام للمؤسسات المستضافة.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                إضافة قسم / فرع جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveBranchAction} submitLabel="إضافة القسم" className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">اسم القسم الجديد</Label>
                  <Input id="name" name="name" placeholder="مثال: المطبخ الشرقي، قسم المطبخ، المستودع" required />
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
