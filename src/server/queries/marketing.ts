/**
 * Marketing domain queries
 * Handles social accounts, posts, and templates
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  demoSocialAccounts,
  demoSocialPosts,
  demoSocialTemplates,
  demoMenuItems,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  optionalText,
  oneOf,
  type AdminClient,
} from "./_shared/utils";
import type { MenuItem, SocialAccount, SocialPost, SocialTemplate } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type MarketingBundle = {
  accounts: SocialAccount[];
  posts: SocialPost[];
  templates: SocialTemplate[];
  menuItems: MenuItem[];
};

// ============================================================================
// Loaders
// ============================================================================

async function loadMarketingBundle(admin: AdminClient, organizationId: string) {
  const [accountRows, postRows, templateRows] = await Promise.all([
    query(admin.from("social_accounts").select("*").eq("organization_id", organizationId).order("platform"), "social_accounts"),
    query(
      admin
        .from("social_posts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      "social_posts",
    ),
    query(admin.from("social_templates").select("*").eq("organization_id", organizationId).order("name"), "social_templates"),
  ]);

  // Load post targets
  const [targetRows, assetRows] = await Promise.all([
    query(admin.from("social_post_targets").select("*").eq("organization_id", organizationId), "social_post_targets"),
    query(admin.from("social_media_assets").select("*").eq("organization_id", organizationId), "social_media_assets"),
  ]);

  // Map posts with targets
  const targetsByPost = new Map<string, typeof targetRows>();
  for (const target of targetRows) {
    const existing = targetsByPost.get(target.social_post_id) ?? [];
    existing.push(target);
    targetsByPost.set(target.social_post_id, existing);
  }

  const assetByPost = new Map<string, (typeof assetRows)[number]>();
  for (const asset of assetRows) {
    if (asset.social_post_id && !assetByPost.has(asset.social_post_id)) {
      assetByPost.set(asset.social_post_id, asset);
    }
  }

  return {
    accounts: accountRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      platform: row.platform as any,
      accountName: row.account_name ?? "",
      status: oneOf(row.status, ["connected", "expired", "disabled", "local_agent"] as const, "disabled"),
      lastPublishedAt: optionalText(row.last_published_at),
      externalAccountId: row.external_account_id ?? "",
      metadata: row.metadata ?? {},
    })),
    posts: postRows.map((row) => {
      const targets = (targetsByPost.get(row.id) ?? []).map((target) => ({
        platform: target.platform as any,
        accountName: target.account_name ?? "",
        status: target.status as "pending" | "ready" | "prepared" | "publishing" | "published" | "failed",
        error: optionalText(target.error_message),
      }));

      return {
        id: row.id,
        organizationId: row.organization_id,
        title: row.title ?? "",
        body: row.body ?? "",
        status: oneOf(row.status, ["draft", "ready", "prepared", "scheduled", "publishing", "published", "failed"] as const, "draft"),
        scheduledAt: optionalText(row.scheduled_at),
        assetUrl: optionalText(assetByPost.get(row.id)?.url ?? assetByPost.get(row.id)?.storage_path),
        imageLocalPath: optionalText(row.image_local_path),
        targets,
        createdAt: row.created_at,
      };
    }),
    templates: templateRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name ?? "",
      category: row.category ?? "general",
      body: row.body ?? "",
    })),
    menuItems: demoMenuItems,
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get full marketing bundle
 */
export async function getMarketingData(): Promise<MarketingBundle> {
  if (isDemoMode()) {
    return {
      accounts: demoSocialAccounts,
      posts: demoSocialPosts,
      templates: demoSocialTemplates,
      menuItems: demoMenuItems,
    };
  }

  return withAdminScope<MarketingBundle>(
    {
      accounts: demoSocialAccounts,
      posts: demoSocialPosts,
      templates: demoSocialTemplates,
      menuItems: demoMenuItems,
    },
    (admin, scope) => loadMarketingBundle(admin, scope.organizationId),
  );
}

/**
 * Get social accounts
 */
export async function getSocialAccounts() {
  if (isDemoMode()) {
    return demoSocialAccounts;
  }

  return withAdminScope<SocialAccount[]>(demoSocialAccounts, async (admin, scope) => {
    const { data } = await admin
      .from("social_accounts")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .order("platform");

    return (data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      platform: row.platform,
      accountName: row.account_name ?? "",
      status: oneOf(row.status, ["connected", "expired", "disabled", "local_agent"] as const, "disabled"),
      lastPublishedAt: optionalText(row.last_published_at),
      externalAccountId: row.external_account_id ?? "",
      metadata: row.metadata ?? {},
    }));
  });
}

/**
 * Get social posts
 */
export async function getSocialPosts(limit = 50) {
  if (isDemoMode()) {
    return demoSocialPosts;
  }

  return withAdminScope<SocialPost[]>(demoSocialPosts, async (admin, scope) => {
    const { data } = await admin
      .from("social_posts")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      title: row.title ?? "",
      body: row.body ?? "",
      status: oneOf(row.status, ["draft", "ready", "prepared", "scheduled", "publishing", "published", "failed"] as const, "draft"),
      scheduledAt: optionalText(row.scheduled_at),
      targets: [],
      createdAt: row.created_at,
    }));
  });
}

/**
 * Get single post with targets
 */
export async function getSocialPost(id: string) {
  if (isDemoMode()) {
    return demoSocialPosts.find((p) => p.id === id) ?? null;
  }

  return withAdminScope(
    demoSocialPosts.find((p) => p.id === id) ?? null,
    async (admin, scope) => {
      const [postRow, targetRows] = await Promise.all([
        admin.from("social_posts").select("*").eq("id", id).eq("organization_id", scope.organizationId).single(),
        admin.from("social_post_targets").select("*").eq("post_id", id),
      ]);

      if (!postRow.data) return null;

      return {
        id: postRow.data.id,
        organizationId: postRow.data.organization_id,
        title: postRow.data.title ?? "",
        body: postRow.data.body ?? "",
        status: oneOf(postRow.data.status, ["draft", "ready", "prepared", "scheduled", "publishing", "published", "failed"] as const, "draft"),
        scheduledAt: optionalText(postRow.data.scheduled_at),
        targets: (targetRows.data ?? []).map((target: any) => ({
          platform: target.platform,
          accountName: target.account_name ?? "",
          status: target.status,
          error: optionalText(target.error_message),
        })),
        createdAt: postRow.data.created_at,
      };
    },
  );
}

/**
 * Get social templates
 */
export async function getSocialTemplates() {
  if (isDemoMode()) {
    return demoSocialTemplates;
  }

  return withAdminScope(demoSocialTemplates, async (admin, scope) => {
    const { data } = await admin
      .from("social_templates")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .order("name");

    return (data ?? []).map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name ?? "",
      category: row.category ?? "general",
      body: row.body ?? "",
    }));
  });
}

/**
 * Get publish job status
 */
export async function getPublishJobStatus(jobId: string) {
  if (isDemoMode()) {
    return {
      id: jobId,
      status: "completed" as const,
      completedAt: new Date().toISOString(),
      results: [],
    };
  }

  return withAdminScope(
    {
      id: jobId,
      status: "completed" as const,
      completedAt: new Date().toISOString(),
      results: [],
    },
    async (admin, scope) => {
      const { data } = await admin
        .from("social_publish_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("organization_id", scope.organizationId)
        .single();

      if (!data) {
        return {
          id: jobId,
          status: "not_found" as const,
          completedAt: null,
          results: [],
        };
      }

      return {
        id: data.id,
        status: data.status as "pending" | "processing" | "completed" | "failed",
        completedAt: data.completed_at,
        results: [],
      };
    },
  );
}
