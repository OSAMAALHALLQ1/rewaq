import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Megaphone,
  Image,
  Plus,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getImageKitStatus } from "@/lib/imagekit";
import { getNodeRedSocialPublishingStatus } from "@/lib/social/node-red";
import { getSocialPlatformLabel } from "@/lib/social/platforms";
import { getMarketingPublishPreferences } from "@/lib/social/preferences";
import { getTriggerDevSocialPublishingStatus } from "@/lib/social/trigger-dev";
import { saveMarketingPublishPreferencesAction } from "@/server/actions/social";
import { getMarketingData } from "@/server/queries/app";

export default async function MarketingCenterPage() {
  const { accounts, posts, templates } = await getMarketingData();
  const imageKitStatus = getImageKitStatus();
  const preferences = await getMarketingPublishPreferences();
  const nodeRedStatus = getNodeRedSocialPublishingStatus();
  const triggerDevStatus = getTriggerDevSocialPublishingStatus();
  const defaultAccountIds = new Set(preferences.defaultAccountIds);
  const connectedAccounts = accounts.filter((account) => account.status === "connected").length;
  const scheduledPosts = posts.filter((post) => post.status === "scheduled").length;
  const failedTargets = posts.flatMap((post) => post.targets).filter((target) => target.status === "failed").length;
  const defaultAccounts = accounts.filter((account) => defaultAccountIds.has(account.id));
  const workflowSteps = [
    {
      title: "Trigger.dev Task",
      body: "رواق يرسل مهمة نشر خلفية لا تنتظر المستخدم ولا تتأثر بالـ timeout.",
      icon: Route,
      tone: "default" as const,
    },
    {
      title: "Credentials",
      body: "Meta/TikTok tokens تأتي من OAuth وتخزن مشفرة، وليس من Trigger.dev.",
      icon: KeyRound,
      tone: "warning" as const,
    },
    {
      title: "ImageKit Media",
      body: "الصور والفيديو ترفع إلى ImageKit ويحصل محرك النشر على رابط عام.",
      icon: Image,
      tone: imageKitStatus.configured ? "success" as const : "warning" as const,
    },
    {
      title: "Switch",
      body: "المهمة تنشر لكل منصة وتعيد المحاولة للمنصة الفاشلة فقط.",
      icon: Workflow,
      tone: "default" as const,
    },
    {
      title: "Response",
      body: "يحفظ runId و providerUrl والسبب عند الفشل في سجل النشر.",
      icon: CheckCircle2,
      tone: "success" as const,
    },
  ];
  const automationCapabilities = [
    "نشر يومي أو كل ساعة",
    "حسب تقويم المحتوى",
    "Google Sheets row trigger",
    "Google Drive upload trigger",
    "RSS article trigger",
    "زر نشر من لوحة التحكم",
  ];
  const contentCapabilities = [
    "نسخة قصيرة لـ X",
    "نسخة مهنية لـ LinkedIn",
    "كابشن Instagram",
    "وصف YouTube Shorts",
    "هاشتاقات لكل منصة",
    "إعادة تدوير مقال إلى أسبوع محتوى",
  ];
  const auditCapabilities = [
    "وقت النشر",
    "المنصة والحساب",
    "النص المنشور",
    "رابط المنشور",
    "سبب الفشل",
    "المستخدم والموافقة",
  ];
  const errorCapabilities = [
    "إعادة المنصة الفاشلة فقط",
    "تنبيه عند فشل Instagram",
    "طلب إعادة ربط Token",
    "تصغير صورة كبيرة",
    "اختصار نص X",
    "انتظار Rate Limit",
  ];

  return (
    <>
      <PageHeader
        title="مركز التسويق"
        description="مركز عملي للنشر: حسابات دائمة، نشر لمرة واحدة، متابعة فشل القنوات، وربط Node-RED واضح."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/marketing/logs">
                <Activity className="h-4 w-4" />
                السجلات
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/marketing/create">
                <Plus className="h-4 w-4" />
                إنشاء منشور
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Megaphone className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">منشورات</p>
            <p className="mt-2 text-2xl font-bold">{posts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CalendarDays className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">مجدولة</p>
            <p className="mt-2 text-2xl font-bold">{scheduledPosts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FileText className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">حسابات متصلة</p>
            <p className="mt-2 text-2xl font-bold">{connectedAccounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">فشل يحتاج متابعة</p>
            <p className="mt-2 text-2xl font-bold">{failedTargets}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  مسار النشر الموحد
                </CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Trigger.dev للتشغيل والجدولة والإعادة، وNode-RED اختياري كمصدر triggers خارجي.</p>
              </div>
              <Badge tone={triggerDevStatus.configured ? "success" : "warning"}>
                {triggerDevStatus.configured ? "Trigger.dev متصل" : "Demo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div key={step.title} className="rounded-lg border bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <Badge tone={step.tone}>{index + 1}</Badge>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تفعيل النظام الحقيقي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>1. اربط الحسابات عبر OAuth واحفظ التوكنات في Supabase بشكل مشفر.</p>
            <p>2. ارفع الصور والفيديو إلى ImageKit واحفظ روابطها العامة.</p>
            <p>3. استدع Trigger.dev task عند النشر أو الجدولة.</p>
            <p>4. دع المهمة تتعامل مع retry و rate limit وحفظ السجلات.</p>
            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
              TRIGGER_DEV_SOCIAL_PUBLISH_ENDPOINT
            </div>
            <Badge tone={imageKitStatus.configured ? "success" : "warning"}>
              {imageKitStatus.configured ? "ImageKit متصل" : "ImageKit غير مضبوط"}
            </Badge>
            <Badge tone={nodeRedStatus.configured ? "success" : "muted"}>
              {nodeRedStatus.configured ? "Node-RED triggers متاحة" : "Node-RED اختياري"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        {[
          { title: "جدولة النشر", items: automationCapabilities, icon: CalendarDays },
          { title: "تخصيص المحتوى", items: contentCapabilities, icon: Sparkles },
          { title: "سجل كامل", items: auditCapabilities, icon: FileText },
          { title: "تعامل مع الأخطاء", items: errorCapabilities, icon: ShieldCheck },
        ].map((group) => {
          const Icon = group.icon;

          return (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5 text-primary" />
                  {group.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>حسابات النشر الدائمة</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveMarketingPublishPreferencesAction} submitLabel="حفظ الحسابات الدائمة" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {accounts.map((account) => {
                  const isConnected = account.status === "connected";

                  return (
                    <Label
                      key={account.id}
                      className="flex min-h-16 items-center gap-3 rounded-lg border bg-white p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="defaultAccountIds"
                        value={account.id}
                        defaultChecked={defaultAccountIds.has(account.id)}
                        disabled={!isConnected}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{getSocialPlatformLabel(account.platform)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{account.accountName}</span>
                      </span>
                      <StatusBadge status={account.status} />
                    </Label>
                  );
                })}
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>النشر القادم يستخدم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                <div>
                  <p className="text-sm font-semibold">{getSocialPlatformLabel(account.platform)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{account.accountName}</p>
                </div>
                <Badge tone="success">دائم</Badge>
              </div>
            ))}
            {defaultAccounts.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                لا توجد حسابات دائمة. اختر حسابًا أو استخدم نشر لمرة واحدة من صفحة إنشاء المنشور.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>آخر المنشورات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المنصات</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="font-semibold">{post.title}</div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{post.body}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {post.targets.map((target) => (
                          <Badge key={`${post.id}-${target.platform}`} tone={target.status === "failed" ? "danger" : "success"}>
                            {getSocialPlatformLabel(target.platform)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(post.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قوالب وخيارات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">قوالب سريعة</h3>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <Badge key={template.id} tone="muted">
                    {template.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard/marketing/create">
                  <Send className="h-4 w-4" />
                  نشر الآن أو لمرة واحدة
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/marketing/calendar">
                  <Clock className="h-4 w-4" />
                  فتح التقويم
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
