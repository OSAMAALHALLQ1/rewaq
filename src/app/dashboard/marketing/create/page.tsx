import { Bot, CalendarClock, Hash, ImagePlus, Repeat, Send, Sparkles, Wand2, Workflow } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getImageKitStatus } from "@/lib/imagekit";
import { getNodeRedSocialPublishingStatus } from "@/lib/social/node-red";
import { SOCIAL_PLATFORM_IDS, socialPlatformMeta } from "@/lib/social/platforms";
import { getMarketingPublishPreferences } from "@/lib/social/preferences";
import { getTriggerDevSocialPublishingStatus } from "@/lib/social/trigger-dev";
import { createSocialPostAction } from "@/server/actions/social";
import { getMarketingData } from "@/server/queries/app";

export default async function CreateSocialPostPage({
  searchParams,
}: {
  searchParams: Promise<{ menuItem?: string }>;
}) {
  const [{ menuItem }, { accounts, templates, menuItems }, preferences] = await Promise.all([
    searchParams,
    getMarketingData(),
    getMarketingPublishPreferences(),
  ]);
  const selectedMenuItem = menuItems.find((item: any) => item.id === menuItem);
  const imageKitStatus = getImageKitStatus();
  const nodeRedStatus = getNodeRedSocialPublishingStatus();
  const triggerDevStatus = getTriggerDevSocialPublishingStatus();
  const defaultAccountIds = new Set(preferences.defaultAccountIds);
  const defaultAccounts = accounts.filter((account: any) => defaultAccountIds.has(account.id));

  return (
    <>
      <PageHeader
        title="إنشاء منشور"
        description="اكتب النص مرة واحدة، واختر القنوات، ثم انشر أو جدول بدون خطوات إضافية."
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
                  {templates.map((template: any) => (
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
                <div className="flex flex-wrap gap-2">
                  <Badge tone="default" className="gap-1">
                    <Bot className="h-3 w-3" />
                    توليد بالذكاء الاصطناعي عبر Node-RED
                  </Badge>
                  <Badge tone="warning" className="gap-1">
                    <Wand2 className="h-3 w-3" />
                    تحسين النص
                  </Badge>
                  <Badge tone="muted" className="gap-1">
                    <Hash className="h-3 w-3" />
                    اقتراح هاشتاقات
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border bg-white p-4">
                <Label>تخصيص المحتوى لكل منصة</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {SOCIAL_PLATFORM_IDS.map((platform) => (
                    <div key={platform} className="grid gap-2">
                      <Label htmlFor={`body_${platform}`}>{socialPlatformMeta[platform].label}</Label>
                      <Textarea
                        id={`body_${platform}`}
                        name={`body_${platform}`}
                        placeholder={platform === "x" ? "نسخة قصيرة لـ X..." : `نسخة ${socialPlatformMeta[platform].label}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>الوسائط</Label>
                <div className="grid gap-3 rounded-lg border border-dashed bg-slate-50 p-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ImagePlus className="h-5 w-5 text-primary" />
                    رفع صورة أو فيديو إلى ImageKit ثم إرسال الرابط لمحرك النشر.
                  </div>
                  <Input
                    name="asset"
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                  />
                  <Select name="mediaKind" defaultValue="text">
                    <option value="text">نص فقط</option>
                    <option value="single_image">صورة واحدة</option>
                    <option value="multi_image">عدة صور / Carousel</option>
                    <option value="reel">Reel / Short / TikTok</option>
                    <option value="pin">Pinterest Pin</option>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={imageKitStatus.configured ? "success" : "warning"}>
                      {imageKitStatus.configured ? "ImageKit متصل" : "ImageKit غير مضبوط"}
                    </Badge>
                    <Badge tone="muted">ik.imagekit.io</Badge>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <Label>حسابات النشر</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex min-h-14 items-center gap-3 rounded-lg border bg-teal-50 p-3 text-sm">
                    <input type="radio" name="accountMode" value="default" defaultChecked />
                    <span>
                      <span className="block font-semibold">استخدم الحسابات الدائمة</span>
                      <span className="block text-xs text-muted-foreground">تتغير من مركز التسويق</span>
                    </span>
                  </label>
                  <label className="flex min-h-14 items-center gap-3 rounded-lg border bg-white p-3 text-sm">
                    <input type="radio" name="accountMode" value="one_time" />
                    <span>
                      <span className="block font-semibold">نشر لمرة واحدة</span>
                      <span className="block text-xs text-muted-foreground">لا يغير الحسابات الدائمة</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>الحسابات الدائمة المختارة</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOCIAL_PLATFORM_IDS.map((platform) => {
                    const meta = socialPlatformMeta[platform];
                    const account = accounts.find((candidate: any) => candidate.platform === platform);

                    return (
                      <label
                        key={platform}
                        className="flex min-h-16 items-center gap-3 rounded-lg border bg-white p-3 text-sm transition hover:border-primary/40 hover:bg-teal-50/40"
                      >
                        <input
                          type="checkbox"
                          value={platform}
                          defaultChecked={account ? defaultAccountIds.has(account.id) : false}
                          disabled
                        />
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                          {meta.shortLabel}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{meta.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {account?.accountName ?? "غير مرتبط"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  لتغيير هذه الحسابات ارجع إلى مركز التسويق واحفظ حسابات النشر الدائمة.
                </p>
              </div>

              <div className="grid gap-3 rounded-lg border bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Repeat className="h-4 w-4 text-primary" />
                  إعداد النشر لمرة واحدة
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="oneTimePlatform">القناة</Label>
                    <Select id="oneTimePlatform" name="oneTimePlatform" defaultValue="facebook">
                      {SOCIAL_PLATFORM_IDS.map((platform) => (
                        <option key={platform} value={platform}>
                          {socialPlatformMeta[platform].label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="oneTimeAccountName">الحساب أو المعرف</Label>
                    <Input id="oneTimeAccountName" name="oneTimeAccountName" placeholder="@restaurant أو اسم الصفحة" />
                  </div>
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
              <div className="grid gap-3 rounded-lg border bg-white p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  جدولة ذكية
                </div>
                <Select name="scheduleKind" defaultValue="manual">
                  <option value="manual">حسب التاريخ المحدد</option>
                  <option value="hourly">كل ساعة</option>
                  <option value="daily">يوميًا</option>
                  <option value="content_calendar">حسب تقويم المحتوى</option>
                  <option value="google_sheets_row">عند إضافة صف في Google Sheets</option>
                  <option value="google_drive_upload">عند رفع صورة في Google Drive</option>
                  <option value="rss_new_article">عند إضافة مقال RSS</option>
                  <option value="dashboard_button">عند ضغط زر من لوحة التحكم</option>
                </Select>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <input type="checkbox" name="approvalRequired" />
                    موافقة قبل النشر
                  </label>
                  <Select name="errorPolicy" defaultValue="retry_failed_only">
                    <option value="retry_failed_only">أعد المنصات الفاشلة فقط</option>
                    <option value="auto_shorten_x">اختصر X إذا كان النص طويلًا</option>
                    <option value="resize_media">صغّر الصورة إذا كان حجمها كبيرًا</option>
                    <option value="rate_limit_wait">انتظر عند Rate Limit ثم أعد المحاولة</option>
                    <option value="notify_only">تنبيه فقط عند الفشل</option>
                  </Select>
                </div>
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
                    <p className="text-sm font-semibold">مطعم إيوان</p>
                    <p className="text-xs text-muted-foreground">
                      {defaultAccounts.length > 0
                        ? defaultAccounts.map((account: any) => socialPlatformMeta[account.platform as keyof typeof socialPlatformMeta].label).join(" / ")
                        : "اختر حسابًا دائمًا أو نشر لمرة واحدة"}
                    </p>
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
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                محرك النشر
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-7 text-muted-foreground">
              <p>{triggerDevStatus.configured ? "النشر يذهب إلى Trigger.dev كمهمة خلفية." : "النشر يعمل محليًا بوضع تجربة، وفور ضبط Trigger.dev ينتقل لمحرك الخلفية."}</p>
              <p>Trigger.dev يشغّل queue/retry/scheduler، أما صلاحيات Meta/TikTok فتأتي من OAuth والتوكنات المخزنة.</p>
              <p>{imageKitStatus.configured ? "الوسائط ترفع إلى ImageKit قبل تشغيل مهمة النشر." : "أضف مفاتيح ImageKit في البيئة لتفعيل رفع الصور والفيديو."}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge tone={triggerDevStatus.configured ? "success" : "warning"}>
                  {triggerDevStatus.configured ? "Trigger.dev متصل" : "Demo fallback"}
                </Badge>
                <Badge tone={nodeRedStatus.configured ? "success" : "muted"}>
                  {nodeRedStatus.configured ? "Node-RED triggers" : "Node-RED اختياري"}
                </Badge>
                <Badge tone="default">9 قنوات</Badge>
                <Badge tone="muted">API جاهز</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
