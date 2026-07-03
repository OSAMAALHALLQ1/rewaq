import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/types/domain";

type PostStatus = "draft" | "ready" | "prepared" | "scheduled" | "publishing" | "published" | "failed";

const statusMapping: Record<PostStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "مسودة", tone: "muted" },
  ready: { label: "جاهز للنشر", tone: "warning" },
  prepared: { label: "مجهز في Meta", tone: "default" },
  scheduled: { label: "مجدول", tone: "warning" },
  publishing: { label: "جاري النشر...", tone: "default" },
  published: { label: "منشور", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
};

export function RawaqStatusBadge({ status }: { status: string }) {
  const normStatus = (status || "draft").toLowerCase() as PostStatus;
  const config = statusMapping[normStatus] || statusMapping.draft;

  return (
    <Badge tone={config.tone}>
      {config.label}
    </Badge>
  );
}

export function RawaqPlatformBadge({ platform }: { platform: string }) {
  const normPlatform = (platform || "").toLowerCase();
  
  let label = platform;
  let classes = "bg-slate-100 text-slate-700 border-slate-200";

  if (normPlatform === "facebook") {
    label = "Facebook";
    classes = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (normPlatform === "instagram") {
    label = "Instagram";
    classes = "bg-pink-50 text-pink-700 border-pink-200";
  } else if (normPlatform === "tiktok") {
    label = "TikTok";
    classes = "bg-slate-900 text-white border-slate-950";
  } else if (normPlatform === "youtube_shorts" || normPlatform === "youtube") {
    label = "YouTube Shorts";
    classes = "bg-red-50 text-red-700 border-red-200";
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}
