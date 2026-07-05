"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RawaqSocialStatsCards } from "./stats-cards";
import { RawaqConnectedAccounts } from "./connected-accounts";
import { RawaqPostComposer, ComposerState } from "./post-composer";
import { RawaqPostPreview } from "./post-preview";
import { RawaqContentCalendarPreview } from "./calendar-preview";
import { RawaqRecentPostsList } from "./recent-posts";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  connectSocialAccountAction,
  disconnectSocialAccountAction,
  activateSocialAccountAction,
  createPreparedSocialPostAction,
  markPreparedSocialPostPublishedAction,
} from "@/server/actions/social";
import { Megaphone, Plus, LayoutDashboard, CalendarDays, Link2, PlusCircle, Sparkles, Clipboard, ExternalLink, CheckCircle2, Download } from "lucide-react";

const META_BUSINESS_SUITE_COMPOSER_URL = "https://business.facebook.com/latest/composer";

type Account = {
  id: string;
  platform: string;
  accountName: string;
  status: "connected" | "expired" | "disabled" | "local_agent";
  externalAccountId?: string;
  metadata?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

type Post = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledAt?: string | null;
  createdAt: string;
  assetUrl?: string | null;
  targets?: Array<{ platform: string }>;
};

type RawaqSocialPublishingPageProps = {
  initialAccounts: Account[];
  initialPosts: Post[];
};

export default function RawaqSocialPublishingPage({
  initialAccounts = [],
  initialPosts = [],
}: RawaqSocialPublishingPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // State for posts and accounts
  const [posts, setPosts] = React.useState<Post[]>(initialPosts);
  const [accounts, setAccounts] = React.useState<Account[]>(initialAccounts);
  
  // Tab control: "dashboard" | "create" | "calendar" | "accounts"
  const [activeTab, setActiveTab] = React.useState<string>("dashboard");

  // Post preview state for the composer
  const [composerPreviewData, setComposerPreviewData] = React.useState({
    title: "",
    body: "",
    hashtags: "",
    platforms: [] as string[],
    publishMode: "now",
    scheduledDate: "",
    scheduledTime: "",
    mediaUrl: "",
    postType: "general"
  });

  // Modal control for viewing existing posts
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);

  // Simulated/Real OAuth Modal States
  const [connectingPlatform, setConnectingPlatform] = React.useState<string | null>(null);
  const [oauthStep, setOauthStep] = React.useState<number>(1);
  const [oauthPageName, setOauthPageName] = React.useState<string>("");

  const selectPlatform = searchParams.get("select_platform");
  const disabledFbAccounts = accounts.filter(
    (a) => a.platform === "facebook" && a.status === "disabled"
  );
  const showSelectModal = selectPlatform === "facebook" && disabledFbAccounts.length > 0;

  // Watch for success or error query params
  React.useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "oauth_connected") {
      alert("✅ تم ربط حساب السوشيال ميديا وتفعيله بنجاح!");
      router.replace("/dashboard/social-publishing");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        invalid_state: "الرمز الأمني للتفويض غير صالح أو منتهي الصلاحية.",
        oauth_init_failed: "فشل بدء الاتصال مع فيسبوك. يرجى التحقق من إعدادات المطور.",
        oauth_callback_failed: "فشل استرداد الصلاحيات من فيسبوك.",
        token_exchange_failed: "فشل تبديل توكن التفويض مع فيسبوك.",
        no_pages_found: "لم نجد أي صفحات فيسبوك مرتبطة بحسابك الشخصي.",
        missing_state: "تم فتح رابط الرجوع مباشرة. استخدم زر التجهيز المحلي بدل OAuth.",
      };
      alert(`❌ خطأ: ${errorMessages[error] || error}`);
      router.replace("/dashboard/social-publishing");
    }
  }, [searchParams, router]);

  // Handler to activate a selected page
  const handleSelectPage = async (accountId: string) => {
    startTransition(async () => {
      const res = await activateSocialAccountAction(accountId);
      if (res.ok) {
        // Find the activated Facebook account
        const activatedFb = accounts.find((a) => a.id === accountId);
        
        // Remove select_platform parameter and refresh state
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete("select_platform");
        router.replace(`/dashboard/social-publishing?${newParams.toString()}`);
        
        if (activatedFb) {
          setAccounts((prev) =>
            prev
              .map((a) => {
                if (a.id === accountId) return { ...a, status: "connected" as const };
                if (a.platform === "instagram" && a.metadata?.facebook_page_id === activatedFb.externalAccountId) {
                  return { ...a, status: "connected" as const };
                }
                return a;
              })
              .filter((a) => {
                if (a.status === "disabled") {
                  if (a.platform === "facebook" && a.id !== accountId) return false;
                  if (a.platform === "instagram" && a.metadata?.facebook_page_id !== activatedFb.externalAccountId) return false;
                }
                return true;
              })
          );
        }
        
        alert("✅ تم ربط وتفعيل الحساب والصفحة بنجاح.");
      } else {
        alert(`خطأ أثناء التفعيل: ${res.message}`);
      }
    });
  };

  // Toggle account connection
  const handleToggleAccount = async (platformId: string) => {
    const exists = accounts.find((a) => a.platform === platformId && (a.status === "connected" || a.status === "local_agent"));
    
    if (exists) {
      if (confirm(`هل أنت متأكد من رغبتك في إلغاء ربط حساب ${platformId}؟`)) {
        startTransition(async () => {
          const res = await disconnectSocialAccountAction(platformId);
          if (res.ok) {
            setAccounts((prev) => prev.filter((a) => a.platform !== platformId));
            alert(res.message);
          } else {
            alert(`خطأ: ${res.message}`);
          }
        });
      }
    } else {
      const defaultAccountNames: Record<string, string> = {
        facebook: "Facebook عبر Rewaq Publisher",
        instagram: "Instagram عبر Rewaq Publisher",
        tiktok: "TikTok عبر Rewaq Publisher",
        youtube_shorts: "YouTube Shorts عبر Rewaq Publisher",
      };

      startTransition(async () => {
        const res = await connectSocialAccountAction(
          platformId,
          defaultAccountNames[platformId] || `${platformId} عبر Rewaq Publisher`,
          `local-agent-${platformId}`,
        );

        if (res.ok) {
          setAccounts((prev) => {
            const filtered = prev.filter((a) => a.platform !== platformId);
            return [
              ...filtered,
              {
                id: `local-${platformId}-${Date.now()}`,
                platform: platformId,
                accountName: defaultAccountNames[platformId] || `${platformId} عبر Rewaq Publisher`,
                status: "local_agent" as const,
                externalAccountId: `local-agent-${platformId}`,
                metadata: { publishing_mode: "semi_automation" },
              },
            ];
          });
          alert("✅ تم تفعيل النشر عبر الوكيل المحلي. لا حاجة لتفويض Meta.");
        } else {
          alert(`خطأ: ${res.message}`);
        }
      });
    }
  };

  const handleConfirmOAuth = async () => {
    if (!oauthPageName.trim()) {
      alert("يرجى تحديد أو كتابة اسم الحساب.");
      return;
    }
    
    setOauthStep(2); // show simulated loading permissions grant
    
    setTimeout(() => {
      startTransition(async () => {
        if (!connectingPlatform) return;
        const res = await connectSocialAccountAction(connectingPlatform, oauthPageName);
        if (res.ok) {
          // Update local state with the new connected account
          setAccounts((prev) => {
            const filtered = prev.filter((a) => a.platform !== connectingPlatform);
            return [
              ...filtered,
              {
                id: `soc-${connectingPlatform}-${Date.now()}`,
                organizationId: "db-org",
                platform: connectingPlatform,
                accountName: oauthPageName,
                status: "connected" as const,
              }
            ];
          });
          setConnectingPlatform(null);
          alert(res.message);
        } else {
          alert(`خطأ في الربط: ${res.message}`);
          setOauthStep(1);
        }
      });
    }, 1500); // simulated OAuth redirect lag
  };

  // List of connected platforms helper
  const connectedPlatforms = accounts
    .filter((a) => a.status === "connected" || a.status === "local_agent")
    .map((a) => a.platform);

  // Handle composer changes to update preview
  const handleComposerChange = (composerState: ComposerState) => {
    setComposerPreviewData({
      title: composerState.title,
      body: composerState.body,
      hashtags: composerState.hashtags,
      platforms: composerState.platforms,
      publishMode: composerState.publishMode,
      scheduledDate: composerState.scheduledDate,
      scheduledTime: composerState.scheduledTime,
      mediaUrl: composerState.mediaUrl,
      postType: composerState.postType
    });
  };

  // Add post helper
  const addPost = (composerState: ComposerState, status: "draft" | "scheduled" | "published") => {
    const scheduledAt =
      composerState.publishMode === "schedule"
        ? `${composerState.scheduledDate}T${composerState.scheduledTime}:00`
        : null;

    const newPost: Post = {
      id: `post-${Date.now()}`,
      title: composerState.title,
      body: composerState.body + (composerState.hashtags ? ` ${composerState.hashtags}` : ""),
      status: status,
      scheduledAt: scheduledAt,
      createdAt: new Date().toISOString(),
      targets: composerState.platforms.map((p) => ({ platform: p })),
    };

    setPosts((prev) => [newPost, ...prev]);
    setActiveTab("dashboard");
    alert(
      status === "draft"
        ? "✅ تم حفظ المنشور كمسودة بنجاح."
        : status === "scheduled"
        ? `📅 تمت جدولة المنشور بنجاح لتاريخ ${composerState.scheduledDate}.`
        : "✅ تم نشر المنشور فوراً بنجاح."
    );
  };

  // Handle composer submit (Publish or Schedule)
  const handleComposerSubmit = (composerState: ComposerState) => {
    const status = composerState.publishMode === "schedule" ? "scheduled" : "published";
    addPost(composerState, status);
  };

  // Handle composer save draft
  const handleComposerSaveDraft = (composerState: ComposerState) => {
    addPost(composerState, "draft");
  };

  const buildCaption = (composerState: ComposerState) =>
    [composerState.body.trim(), composerState.hashtags.trim()].filter(Boolean).join("\n\n");

  const copyCaption = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      return true;
    } catch {
      return false;
    }
  };

  const downloadLocalImage = (composerState: ComposerState) => {
    if (!composerState.mediaFile || !composerState.mediaUrl) return;

    const link = document.createElement("a");
    link.href = composerState.mediaUrl;
    link.download = composerState.mediaFile.name || `rewaq-social-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePreparePost = async (composerState: ComposerState) => {
    const caption = buildCaption(composerState);
    const formData = new FormData();
    formData.set("title", composerState.title);
    formData.set("body", caption);
    formData.set("publishMode", composerState.publishMode);
    if (composerState.publishMode === "schedule") {
      formData.set("scheduledAt", `${composerState.scheduledDate}T${composerState.scheduledTime}:00`);
    }
    composerState.platforms.forEach((platform) => formData.append("platforms", platform));
    if (composerState.mediaFile) {
      formData.set("asset", composerState.mediaFile);
    }

    startTransition(async () => {
      const res = await createPreparedSocialPostAction({ ok: false, message: "" }, formData);
      if (!res.ok) {
        alert(`خطأ: ${res.message}`);
        return;
      }

      await copyCaption(caption);
      downloadLocalImage(composerState);
      window.open(META_BUSINESS_SUITE_COMPOSER_URL, "_blank", "noopener,noreferrer");

      const newPost: Post = {
        id: res.postId || `post-${Date.now()}`,
        title: composerState.title,
        body: caption,
        status: composerState.publishMode === "draft" ? "draft" : "ready",
        scheduledAt:
          composerState.publishMode === "schedule"
            ? `${composerState.scheduledDate}T${composerState.scheduledTime}:00`
            : null,
        createdAt: new Date().toISOString(),
        assetUrl: res.assetUrl,
        targets: composerState.platforms.map((p) => ({ platform: p })),
      };

      setPosts((prev) => [newPost, ...prev]);
      setSelectedPost(newPost);
      setActiveTab("dashboard");
      alert(res.message);
    });
  };

  const handleMarkPublished = async (post: Post) => {
    startTransition(async () => {
      const res = await markPreparedSocialPostPublishedAction(post.id);
      if (!res.ok) {
        alert(`خطأ: ${res.message}`);
        return;
      }

      setPosts((prev) =>
        prev.map((candidate) =>
          candidate.id === post.id ? { ...candidate, status: "published", scheduledAt: candidate.scheduledAt } : candidate,
        ),
      );
      setSelectedPost((current) => (current?.id === post.id ? { ...current, status: "published" } : current));
      alert(res.message);
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            النشر عبر السوشيال ميديا
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            أنشئ منشورات المطعم، جهّز العروض، وجدول النشر على حساباتك الاجتماعية من داخل رواق.
          </p>
        </div>
        
        {activeTab !== "create" && (
          <Button
            type="button"
            onClick={() => setActiveTab("create")}
            className="gap-1.5 self-start md:self-center"
          >
            <Plus className="h-4 w-4" />
            منشور جديد
          </Button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3" style={{ direction: "rtl" }}>
        <Button
          type="button"
          variant={activeTab === "dashboard" ? "default" : "outline"}
          onClick={() => setActiveTab("dashboard")}
          className="gap-1 text-xs font-bold"
        >
          <LayoutDashboard className="h-4 w-4" />
          لوحة التحكم والمتابعة
        </Button>
        <Button
          type="button"
          variant={activeTab === "create" ? "default" : "outline"}
          onClick={() => setActiveTab("create")}
          className="gap-1 text-xs font-bold"
        >
          <PlusCircle className="h-4 w-4" />
          إنشاء منشور جديد
        </Button>
        <Button
          type="button"
          variant={activeTab === "calendar" ? "default" : "outline"}
          onClick={() => setActiveTab("calendar")}
          className="gap-1 text-xs font-bold"
        >
          <CalendarDays className="h-4 w-4" />
          تقويم النشر
        </Button>
        <Button
          type="button"
          variant={activeTab === "accounts" ? "default" : "outline"}
          onClick={() => setActiveTab("accounts")}
          className="gap-1 text-xs font-bold"
        >
          <Link2 className="h-4 w-4" />
          الحسابات وقنوات النشر
        </Button>
      </div>

      {/* Tab Contents */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <RawaqSocialStatsCards posts={posts} />
          
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <RawaqRecentPostsList posts={posts} onSelectPost={setSelectedPost} />
            </div>
            
            <div className="space-y-6">
              <RawaqConnectedAccounts
                accounts={accounts}
                onToggleAccount={handleToggleAccount}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              محتوى المنشور والعرض
            </h2>
            <RawaqPostComposer
              connectedPlatforms={connectedPlatforms}
              onChange={handleComposerChange}
              onSubmit={handleComposerSubmit}
              onSaveDraft={handleComposerSaveDraft}
              onPrepare={handlePreparePost}
            />
          </div>
          
          <div>
            <RawaqPostPreview data={composerPreviewData} />
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="max-w-4xl mx-auto">
          <RawaqContentCalendarPreview posts={posts} />
        </div>
      )}

      {activeTab === "accounts" && (
        <div className="max-w-3xl mx-auto">
          <RawaqConnectedAccounts
            accounts={accounts}
            onToggleAccount={handleToggleAccount}
          />
        </div>
      )}

      {/* Modal for viewing single post */}
      {selectedPost && (
        <Modal
          open={!!selectedPost}
          title={selectedPost.title}
          description="معاينة تفاصيل المنشور الترويجي وحالته على وسائل التواصل الاجتماعي."
          onClose={() => setSelectedPost(null)}
          className="sm:max-w-lg"
        >
          <div className="space-y-4">
            <RawaqPostPreview
              data={{
                title: selectedPost.title,
                body: selectedPost.body,
                hashtags: "",
                platforms: selectedPost.targets?.map((t) => t.platform) || [],
                publishMode: selectedPost.status === "scheduled" ? "schedule" : "now",
                scheduledDate: selectedPost.scheduledAt ? selectedPost.scheduledAt.split("T")[0] : "",
                scheduledTime: selectedPost.scheduledAt ? selectedPost.scheduledAt.split("T")[1]?.slice(0, 5) || "" : "",
                mediaUrl: "", // mock fallback handles it
                postType: "general"
              }}
            />

            {(selectedPost.status === "ready" || selectedPost.status === "prepared") && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-bold">خطوة النشر اليدوي الذكي</p>
                <p className="mt-1 text-xs leading-5">
                  انسخ الكابشن وافتح Meta Business Suite. بعد الضغط على Publish من داخل Meta، اضغط &quot;تم النشر&quot; هنا.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 bg-white"
                    onClick={() => copyCaption(selectedPost.body)}
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    نسخ الكابشن
                  </Button>
                  {selectedPost.assetUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 bg-white"
                      onClick={() => window.open(selectedPost.assetUrl || "", "_blank", "noopener,noreferrer")}
                    >
                      <Download className="h-3.5 w-3.5" />
                      فتح الصورة
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 bg-white"
                    onClick={() => window.open(META_BUSINESS_SUITE_COMPOSER_URL, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    فتح Meta Business Suite
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleMarkPublished(selectedPost)}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    تم النشر
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between border-t pt-3 text-xs text-slate-500">
              <span>تاريخ الإضافة: {new Date(selectedPost.createdAt).toLocaleDateString("ar-EG")}</span>
              <div className="flex items-center gap-2">
                <span>حالة النشر العامة:</span>
                <span className="font-bold text-slate-700">
                  {selectedPost.status === "published"
                    ? "تم النشر بنجاح"
                    : selectedPost.status === "scheduled"
                    ? "مجدول للنشر لاحقاً"
                    : "مسودة"}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal for Mock OAuth Flow */}
      {connectingPlatform && (
        <Modal
          open={!!connectingPlatform}
          title={`ربط حساب ${connectingPlatform === "facebook" ? "Facebook" : connectingPlatform === "instagram" ? "Instagram" : connectingPlatform === "tiktok" ? "TikTok" : "YouTube Shorts"}`}
          description={`طلب تفويض النشر المباشر لرواق عبر OAuth.`}
          onClose={() => setConnectingPlatform(null)}
          className="sm:max-w-md overflow-hidden text-right"
        >
          {oauthStep === 1 ? (
            <div className="space-y-4 py-2" dir="rtl">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <p className="font-semibold text-slate-800 text-sm mb-2">الصلاحيات المطلوبة لتطبيق رواق:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>إدارة منشورات الصفحة ونشر الوسائط وعروض الوجبات</li>
                  <li>قراءة إحصائيات التفاعل ونسب المشاهدة للمنشورات</li>
                  <li>قراءة معلومات الحساب العامة (اسم الصفحة والمُعرّف)</li>
                </ul>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="oauth-handle" className="text-slate-700 font-bold">
                  {connectingPlatform === "facebook" || connectingPlatform === "instagram"
                    ? "اسم الصفحة أو الحساب المستهدف للربط"
                    : "معرّف الحساب (Handle)"}
                </Label>
                <Input
                  id="oauth-handle"
                  value={oauthPageName}
                  onChange={(e) => setOauthPageName(e.target.value)}
                  placeholder="مثال: مطعم رواق للوجبات"
                  className="border-slate-200 text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button variant="outline" type="button" onClick={() => setConnectingPlatform(null)}>
                  إلغاء
                </Button>
                <Button type="button" onClick={handleConfirmOAuth} disabled={isPending}>
                  {isPending ? "جاري الاتصال..." : "تأكيد ومنح الصلاحيات 🔑"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4" dir="rtl">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8 animate-spin" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-md">جاري منح الصلاحيات وتحويل التوكن</h3>
                <p className="text-xs text-slate-500 mt-1 leading-5">
                  يرجى الانتظار، نقوم بإنشاء اتصال تفويض آمن مع {connectingPlatform} وحفظ معلومات الربط في قاعدة بيانات Supabase...
                </p>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal for Page Selection */}
      {showSelectModal && (
        <Modal
          open={showSelectModal}
          title="اختر صفحة فيسبوك لربطها بمطعمك"
          description="تم العثور على أكثر من صفحة يديرها حسابك على فيسبوك. يرجى تحديد الصفحة الرسمية لمطعمك لتفعيل النشر والربط الحقيقي."
          onClose={() => {
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete("select_platform");
            router.replace(`/dashboard/social-publishing?${newParams.toString()}`);
          }}
          className="sm:max-w-md overflow-hidden text-right"
        >
          <div className="space-y-4 py-2" dir="rtl">
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {disabledFbAccounts.map((page) => {
                // Find if there is a linked Instagram account for this page
                const linkedIg = accounts.find(
                  (a) =>
                    a.platform === "instagram" &&
                    a.status === "disabled" &&
                    a.metadata?.facebook_page_id === page.externalAccountId
                );

                return (
                  <div
                    key={page.id}
                    className="flex flex-col justify-between p-4 border rounded-xl bg-slate-50 hover:bg-slate-100 transition gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{page.accountName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">معرف الصفحة: {page.externalAccountId}</p>
                      {linkedIg && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-pink-600 font-semibold bg-pink-50 rounded-lg p-1.5 border border-pink-100">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white font-black text-[9px]">I</span>
                          <span>حساب انستغرام المرتبط: {linkedIg.accountName}</span>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      type="button"
                      onClick={() => handleSelectPage(page.id)}
                      disabled={isPending}
                      className="w-full text-xs font-bold gap-1.5 h-9"
                    >
                      ربط هذه الصفحة 🔗
                    </Button>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams.toString());
                  newParams.delete("select_platform");
                  router.replace(`/dashboard/social-publishing?${newParams.toString()}`);
                }}
              >
                إغلاق
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
