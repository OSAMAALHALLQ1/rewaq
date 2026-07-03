import * as React from "react";
import RawaqSocialPublishingPage from "@/components/social-publishing/index";
import { getMarketingData } from "@/server/queries/marketing";

export const metadata = {
  title: "النشر عبر السوشيال ميديا — رواق",
  description: "أنشئ وجدول منشورات المطعم من مكان واحد داخل نظام رواق.",
};

export default async function SocialPublishingRoute() {
  const { accounts, posts } = await getMarketingData();

  // Map backend account statuses and formatting to match what our component expects
  const formattedAccounts = accounts.map((acc: any) => ({
    id: acc.id,
    platform: acc.platform,
    accountName: acc.accountName,
    status: acc.status as "connected" | "expired" | "disabled" | "local_agent",
    externalAccountId: acc.externalAccountId || "",
    metadata: acc.metadata || {},
  }));

  const formattedPosts = posts.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    status: post.status,
    scheduledAt: post.scheduledAt,
    createdAt: post.createdAt,
    assetUrl: post.assetUrl || null,
    targets: post.targets?.map((t) => ({ platform: t.platform })) || [],
  }));

  return (
    <RawaqSocialPublishingPage
      initialAccounts={formattedAccounts}
      initialPosts={formattedPosts}
    />
  );
}
