import { Bell, Bot, Shield, Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getOrganizationContext } from "@/server/queries/app";

export default async function SettingsPage() {
  const { organization } = await getOrganizationContext();

  return (
    <>
      <PageHeader
        title="الإعدادات"
        description="إعدادات المؤسسة، الأتمتة البسيطة، التنبيهات، وتهيئة التكاملات القادمة."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              بيانات المؤسسة
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
              <Label>نسبة تكلفة الطعام المستهدفة</Label>
              <Input type="number" defaultValue="35" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              الأتمتة البسيطة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "عند انخفاض مخزون مادة: أرسل تنبيه",
              "عند إضافة عرض: اقترح منشور",
              "عند ارتفاع سعر مورد: أرسل تنبيه",
              "عند جدولة منشور: أضفه للـ publish queue",
              "عند فشل نشر: سجل الخطأ وأظهره",
            ].map((rule, index) => (
              <div key={rule} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{rule}</span>
                <Badge tone={index < 3 ? "success" : "warning"}>{index < 3 ? "جاهز" : "قريبًا"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              التنبيهات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["low_stock", "price_increase", "high_food_cost", "publish_failed", "purchase_received", "waste_logged"].map((type) => (
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
            <p>لاحقًا: تشفير مفاتيح حسابات التواصل قبل الإنتاج.</p>
            <p>مفتاح الخدمة يستخدم فقط في مهام موثوقة ولا يرسل للمتصفح.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
