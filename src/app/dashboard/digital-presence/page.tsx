import Link from "next/link";
import { ExternalLink, Globe2, ImageIcon, Link2, Save, Store, Utensils } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  saveRestaurantSiteAction,
  setRestaurantSiteMenuItemAction,
} from "@/server/actions/digital-presence";
import { getDigitalPresenceData } from "@/server/queries/digital-presence";
import { formatCurrency } from "@/lib/utils";

export default async function DigitalPresencePage() {
  const { site, menuItems, branches } = await getDigitalPresenceData();
  const publishedItems = menuItems.filter((item) => item.publication?.isVisible).length;

  return (
    <>
      <PageHeader
        title="المنيو الإلكتروني والموقع"
        description="موقع واحد يعرض نفس أصناف المنيو وأسعارها وحالتها التشغيلية؛ لا حاجة لنسخ الأصناف مرتين."
        actions={site?.status === "published" ? (
          <Button asChild variant="outline">
            <Link href={`/m/${site.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
              فتح الموقع
            </Link>
          </Button>
        ) : undefined}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><Globe2 className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">حالة الموقع</p><Badge className="mt-1" tone={site?.status === "published" ? "success" : "warning"}>{site?.status === "published" ? "منشور" : site ? "مسودة" : "غير منشأ"}</Badge></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Utensils className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">أصناف ظاهرة</p><p className="text-2xl font-black">{publishedItems}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Link2 className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">الرابط</p><p className="max-w-[240px] truncate text-sm font-bold" dir="ltr">{site ? `/m/${site.slug}` : "يُنشأ بعد الحفظ"}</p></div></CardContent></Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="xl:sticky xl:top-20">
          <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" />هوية الموقع والنشر</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={saveRestaurantSiteAction} submitLabel={site ? "حفظ إعدادات الموقع" : "إنشاء الموقع كمسودة"} className="space-y-4">
              <input type="hidden" name="siteId" value={site?.id ?? ""} />
              <div className="grid gap-2"><Label htmlFor="displayName">اسم المطعم</Label><Input id="displayName" name="displayName" defaultValue={site?.displayName ?? ""} required maxLength={160} /></div>
              <div className="grid gap-2"><Label htmlFor="slug">رابط الموقع بالإنجليزية</Label><div className="flex items-center gap-2" dir="ltr"><span className="text-sm text-muted-foreground">/m/</span><Input id="slug" name="slug" defaultValue={site?.slug ?? ""} placeholder="my-restaurant" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div></div>
              <div className="grid gap-2"><Label htmlFor="branchId">الفرع المرتبط</Label><Select id="branchId" name="branchId" defaultValue={site?.branchId ?? ""}><option value="">كل الفروع</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
              <div className="grid gap-2"><Label htmlFor="tagline">عبارة ترحيبية</Label><Input id="tagline" name="tagline" defaultValue={site?.tagline ?? ""} maxLength={200} /></div>
              <div className="grid gap-2"><Label htmlFor="description">نبذة عن المطعم</Label><textarea id="description" name="description" defaultValue={site?.description ?? ""} maxLength={2000} rows={4} className="rounded-md border bg-background px-3 py-2 text-sm" /></div>
              <div className="grid gap-2"><Label htmlFor="logoUrl">رابط الشعار</Label><Input id="logoUrl" name="logoUrl" defaultValue={site?.logoUrl ?? ""} dir="ltr" /></div>
              <div className="grid gap-2"><Label htmlFor="coverUrl">رابط صورة الغلاف</Label><Input id="coverUrl" name="coverUrl" defaultValue={site?.coverUrl ?? ""} dir="ltr" /></div>
              <div className="grid gap-2"><Label htmlFor="primaryColor">اللون الرئيسي</Label><div className="flex gap-2"><Input id="primaryColor" name="primaryColor" type="color" defaultValue={site?.primaryColor ?? "#0f766e"} className="w-16 p-1" /><Input value={site?.primaryColor ?? "#0f766e"} readOnly dir="ltr" /></div></div>
              <div className="grid gap-2"><Label htmlFor="contactPhone">هاتف التواصل</Label><Input id="contactPhone" name="contactPhone" defaultValue={site?.contactPhone ?? ""} dir="ltr" /></div>
              <div className="grid gap-2"><Label htmlFor="whatsappPhone">رقم WhatsApp</Label><Input id="whatsappPhone" name="whatsappPhone" defaultValue={site?.whatsappPhone ?? ""} dir="ltr" /></div>
              <div className="grid gap-2"><Label htmlFor="address">العنوان</Label><Input id="address" name="address" defaultValue={site?.address ?? ""} /></div>
              <div className="grid gap-2"><Label htmlFor="status">حالة النشر</Label><Select id="status" name="status" defaultValue={site?.status ?? "draft"}><option value="draft">مسودة</option>{site && <option value="published">منشور للعامة</option>}{site && <option value="archived">مؤرشف</option>}</Select>{site && publishedItems === 0 && <p className="text-xs text-amber-700">اربط صنفاً ظاهراً واحداً على الأقل قبل اختيار «منشور».</p>}</div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Utensils className="h-5 w-5 text-primary" />الأصناف المرتبطة بالمنيو العام</CardTitle><p className="text-sm text-muted-foreground">الاسم والسعر والحالة تُقرأ مباشرة من «أطباق القائمة». هنا تضيف فقط وصف العرض والتصنيف والصورة والترتيب.</p></CardHeader>
          <CardContent className="space-y-4">
            {!site ? (
              <div className="rounded-xl border border-dashed p-10 text-center"><Globe2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-bold">أنشئ الموقع كمسودة أولاً</p><p className="mt-1 text-sm text-muted-foreground">بعد الحفظ ستظهر أدوات ربط أصناف المنيو هنا.</p></div>
            ) : menuItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center"><Utensils className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-bold">لا توجد أطباق قائمة</p><Button asChild className="mt-4"><Link href="/dashboard/menu-items">إضافة طبق</Link></Button></div>
            ) : (
              menuItems.map((item) => {
                const publication = item.publication;
                const canPublish = item.status === "active" && (!site.branchId || !item.branchId || item.branchId === site.branchId);
                return (
                  <ActionForm key={item.id} action={setRestaurantSiteMenuItemAction} submitLabel="حفظ ربط الصنف" className="rounded-xl border p-4">
                    <input type="hidden" name="siteId" value={site.id} />
                    <input type="hidden" name="menuItemId" value={item.id} />
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-muted"><ImageIcon className="h-5 w-5 text-muted-foreground" /></span><div><h3 className="font-black">{item.name}</h3><p className="text-sm text-muted-foreground">{formatCurrency(item.sellingPrice)} — {item.status}</p></div></div><div className="flex gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={publication?.isFeatured ?? false} /> مميز</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isVisible" defaultChecked={publication?.isVisible ?? false} disabled={!canPublish} /> ظاهر</label></div></div>
                    {!canPublish && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">الصنف متوقف أو يتبع فرعاً مختلفاً، لذلك لا يمكن إظهاره.</p>}
                    <div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>التصنيف</Label><Input name="categoryName" defaultValue={publication?.categoryName ?? "القائمة"} required /></div><div className="grid gap-1.5"><Label>الترتيب</Label><Input name="displayOrder" type="number" defaultValue={publication?.displayOrder ?? 0} /></div><div className="grid gap-1.5 md:col-span-2"><Label>وصف العرض</Label><Input name="publicDescription" defaultValue={publication?.publicDescription ?? ""} maxLength={1000} /></div><div className="grid gap-1.5 md:col-span-2"><Label>رابط صورة العرض (اختياري)</Label><Input name="imageUrl" defaultValue={publication?.imageUrl || item.imagePath} dir="ltr" /></div></div>
                  </ActionForm>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><Save className="mt-0.5 h-4 w-4 text-primary" /><p>تغيير سعر الطبق أو إيقافه من صفحة «أطباق القائمة» ينعكس على الموقع والمنيو العام تلقائياً؛ بيانات العرض هنا لا تنشئ نسخة ثانية من الصنف.</p></div>
    </>
  );
}
