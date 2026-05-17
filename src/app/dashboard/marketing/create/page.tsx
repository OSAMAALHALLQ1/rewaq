import { ImagePlus, Send, Sparkles } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSocialPostAction } from "@/server/actions/social";
import { getMarketingData } from "@/server/queries/app";

export default async function CreateSocialPostPage({
  searchParams,
}: {
  searchParams: Promise<{ menuItem?: string }>;
}) {
  const [{ menuItem }, { templates, menuItems }] = await Promise.all([searchParams, getMarketingData()]);
  const selectedMenuItem = menuItems.find((item) => item.id === menuItem);

  return (
    <>
      <PageHeader
        title="إنشاء منشور"
        description="نشر الآن، جدولة، أو حفظ كمسودة. كل منصة تحتفظ بحالة نشر مستقلة."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              محتوى المنشور
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createSocialPostAction} submitLabel="تنفيذ" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">عنوان داخلي</Label>
                <Input id="title" name="title" defaultValue={selectedMenuItem ? `منشور ${selectedMenuItem.name}` : ""} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template">قالب</Label>
                <Select id="template" name="template">
                  <option value="">بدون قالب</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">النص الأساسي</Label>
                <Textarea
                  id="body"
                  name="body"
                  required
                  defaultValue={
                    selectedMenuItem
                      ? `جربوا ${selectedMenuItem.name} اليوم بسعر ${selectedMenuItem.sellingPrice} شيكل. متوفر في فروعنا.`
                      : ""
                  }
                  placeholder="اكتب عرض اليوم أو طبق جديد..."
                />
              </div>
              <div className="grid gap-2">
                <Label>الصورة</Label>
                <div className="flex items-center gap-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
                  <ImagePlus className="h-5 w-5 text-primary" />
                  رفع صورة إلى Supabase Storage عند تفعيل التخزين.
                </div>
              </div>
              <div className="grid gap-2">
                <Label>المنصات</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {["facebook", "instagram", "telegram"].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                      <input type="checkbox" name="platforms" value={platform} defaultChecked={platform !== "instagram"} />
                      {platform}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="publishMode">طريقة النشر</Label>
                <Select id="publishMode" name="publishMode" defaultValue="now">
                  <option value="now">نشر الآن</option>
                  <option value="schedule">جدولة</option>
                  <option value="draft">حفظ كمسودة</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduledAt">وقت الجدولة</Label>
                <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                معاينة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-semibold">مطعم التايلندي</p>
                    <p className="text-xs text-muted-foreground">فيسبوك / تلغرام</p>
                  </div>
                </div>
                <p className="text-sm leading-7">
                  {selectedMenuItem
                    ? `جربوا ${selectedMenuItem.name} اليوم بسعر ${selectedMenuItem.sellingPrice} شيكل.`
                    : "اكتب النص الأساسي لرؤية معاينة المنشور هنا."}
                </p>
                <div className="mt-4 aspect-video rounded-lg bg-gradient-to-br from-teal-100 via-white to-orange-100" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ملاحظات تقنية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-7 text-muted-foreground">
              <p>فيسبوك وإنستغرام وتلغرام تعمل الآن عبر طبقة نشر تجريبية قابلة للاستبدال بالربط الحقيقي.</p>
              <p>لاحقًا: تشفير مفاتيح الربط قبل التخزين وتفعيل المصادقة الحقيقية.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge tone="default">واجهة نشر موحدة</Badge>
                <Badge tone="warning">فشل جزئي آمن</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
