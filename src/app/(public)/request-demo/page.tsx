import { ActionForm } from "@/components/action-form";
import { SiteHeader } from "@/components/public/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestDemoAction } from "@/server/actions/mutations";

export default function RequestDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-6">
        <div>
          <h1 className="text-4xl font-black">احجز عرضًا تجريبيًا</h1>
          <p className="mt-4 text-lg leading-9 text-muted-foreground">
            أخبرنا عن عدد الفروع وحجم العمليات، وسنريك كيف تبدو إدارة المخزون والتكلفة والتسويق داخل
            رواق.
          </p>
          <div className="mt-8 rounded-lg border bg-white p-5">
            <h2 className="font-semibold">ماذا سنغطي؟</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
              <li>تدفق إدخال المواد والموردين.</li>
              <li>استلام طلب شراء وتوليد stock movements.</li>
              <li>حساب تكلفة الطعام لوصفة وطبق قائمة.</li>
              <li>إنشاء منشور وجدولته على المنصات.</li>
            </ul>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>بيانات التواصل</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={requestDemoAction} submitLabel="إرسال الطلب" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" placeholder="اسمك" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restaurant">اسم المطعم</Label>
                <Input id="restaurant" name="restaurant" placeholder="مثال: مطعم إيوان" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input id="phone" name="phone" placeholder="+970..." required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">البريد</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">ملاحظات</Label>
                <Textarea id="message" name="message" placeholder="عدد الفروع، نظام POS المستخدم، أو أهم مشكلة حاليًا" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
