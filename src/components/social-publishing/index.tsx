"use client";

import * as React from "react";
import { RawaqSocialStatsCards } from "./stats-cards";
import { RawaqConnectedAccounts } from "./connected-accounts";
import { RawaqPostComposer, ComposerState } from "./post-composer";
import { RawaqPostPreview } from "./post-preview";
import { RawaqContentCalendarPreview } from "./calendar-preview";
import { RawaqRecentPostsList } from "./recent-posts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Megaphone, Plus, LayoutDashboard, CalendarDays, Link2, PlusCircle, Sparkles } from "lucide-react";

type Account = {
  id: string;
  platform: string;
  accountName: string;
  status: "connected" | "expired" | "disabled";
};

type Post = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledAt?: string | null;
  createdAt: string;
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

  // Toggle account connection mock
  const handleToggleAccount = (platformId: string) => {
    setAccounts((prev) => {
      const exists = prev.find((a) => a.platform === platformId);
      if (exists) {
        if (exists.status === "connected") {
          return prev.map((a) => (a.platform === platformId ? { ...a, status: "disabled" as const } : a));
        } else {
          return prev.map((a) => (a.platform === platformId ? { ...a, status: "connected" as const } : a));
        }
      } else {
        return [
          ...prev,
          {
            id: `soc-${platformId}-${Date.now()}`,
            organizationId: "demo-org",
            platform: platformId,
            accountName: `rawaq.${platformId}`,
            status: "connected" as const,
          },
        ];
      }
    });
  };

  // List of connected platforms helper
  const connectedPlatforms = accounts
    .filter((a) => a.status === "connected")
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
    </div>
  );
}
