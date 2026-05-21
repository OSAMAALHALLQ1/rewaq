import { Bell, Building2, Shield, Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getOrganizationContext } from "@/server/queries/app";

const departments = [
  "قسم المحاسبة",
  "قسم الضيافة",
  "قسم الخدمات",
  "المطبخ الغربي",
  "المطبخ الشرقي",
  "الشاورمة والمشاوي",
  "قسم التسويق",
];

export default async function SettingsPage() {
  const { organization } = await getOrganizationContext();

  return (
    <>
      <PageHeader
        title="الإعدادات / الأقسام"
        description="إعدادات المخزن والأقسام الداخلية التي تصرف وتستلم المواد."
      />
      <div className="grid gap-4 xl:grid-cols-2">
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
              <Input defaultValue={organization.name} />
            </div>
            <div className="grid gap-2">
              <Label>العملة</Label>
              <Select defaultValue="ILS">
                <option value="ILS">شيكل</option>
                <option value="USD">دولار</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>طريقة ترقيم فواتير التوريد</Label>
              <Input defaultValue="SUP-{YYYY}-{0000}" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              الأقسام المطلوبة
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <div key={department} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-semibold">{department}</span>
                <Badge tone="success">مفعل</Badge>
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
              <label key={type} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <input type="checkbox" defaultChecked />
                {type}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              الأمان
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>عزل الصفوف مفعل على جداول كل مؤسسة في ملف قاعدة البيانات.</p>
            <p>صلاحيات المخزن تفصل بين اعتماد التوريد، التحويل الداخلي، وتسجيل التالف.</p>
            <p>مفتاح الخدمة يستخدم فقط في مهام موثوقة ولا يرسل للمتصفح.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
