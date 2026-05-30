import "server-only";

import { publishSocialPost } from "@/lib/social/publisher";
import type { SocialPlatform } from "@/types/domain";

type AdminClient = any;
type TargetStatus = "pending" | "publishing" | "published" | "failed";
type RecurrenceInterval = "none" | "daily" | "weekly";

type PublishTargetRow = {
  id: string;
  organization_id: string;
  social_post_id: string;
  social_account_id: string;
  platform: SocialPlatform;
  body_override: string | null;
};

type PublishPostRow = {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  scheduled_at: string | null;
  recurrence_interval?: RecurrenceInterval | null;
  created_by: string | null;
};

function targetStatusFromResult(status: "published" | "queued" | "failed"): TargetStatus {
  return status === "queued" ? "publishing" : status;
}

function nextScheduledAt(value: string | null, recurrence: RecurrenceInterval) {
  const base = value ? new Date(value) : new Date();
  const next = new Date(base);

  if (recurrence === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (recurrence === "weekly") {
    next.setDate(next.getDate() + 7);
  }

  while (next <= new Date()) {
    if (recurrence === "daily") next.setDate(next.getDate() + 1);
    if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  }

  return next.toISOString();
}

export async function publishTargetsForPost({
  admin,
  post,
  targets,
  requestedBy,
}: {
  admin: AdminClient;
  post: PublishPostRow;
  targets: PublishTargetRow[];
  requestedBy: string | null;
}) {
  if (targets.length === 0) {
    return { total: 0, published: 0, failed: 0, queued: 0 };
  }

  const [accountResult, assetResult] = await Promise.all([
    admin
      .from("social_accounts")
      .select("id,account_name")
      .eq("organization_id", post.organization_id)
      .in("id", targets.map((target) => target.social_account_id)),
    admin
      .from("social_media_assets")
      .select("*")
      .eq("organization_id", post.organization_id)
      .eq("social_post_id", post.id)
      .order("created_at", { ascending: true }),
  ]);

  if (accountResult.error) throw new Error(accountResult.error.message);
  if (assetResult.error) throw new Error(assetResult.error.message);

  const accountMap = new Map((accountResult.data ?? []).map((account: any) => [account.id, account]));
  const firstAsset = (assetResult.data ?? [])[0] as any;

  const results = await publishSocialPost(
    targets.map((target) => {
      const account = accountMap.get(target.social_account_id);

      return {
        organizationId: post.organization_id,
        postId: post.id,
        platform: target.platform,
        accountId: target.social_account_id,
        accountName: (account as any)?.account_name ?? target.platform,
        body: target.body_override || post.body,
        assetUrl: firstAsset?.url ?? firstAsset?.storage_path ?? undefined,
        mediaKind: firstAsset?.media_kind ?? undefined,
        scheduleKind: "cron",
        errorPolicy: "retry_failed_only",
      };
    }),
  );

  await Promise.all(
    results.map(async (result) => {
      const target = targets.find((candidate) => candidate.platform === result.platform);
      if (!target) return;

      const targetStatus = targetStatusFromResult(result.status);

      await Promise.all([
        admin
          .from("social_post_targets")
          .update({
            status: targetStatus,
            provider_post_id: result.providerPostId ?? null,
            provider_url: result.providerUrl ?? null,
            error_message: result.error ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id),
        admin.from("social_publish_logs").insert({
          organization_id: post.organization_id,
          social_post_id: post.id,
          target_id: target.id,
          social_account_id: target.social_account_id,
          platform: result.platform,
          status: targetStatus,
          message: result.error ?? (result.status === "queued" ? "تم وضع النشر في الطابور" : "تم تنفيذ النشر"),
          provider_post_id: result.providerPostId ?? null,
          provider_url: result.providerUrl ?? null,
          error_message: result.error ?? null,
          retryable: result.status === "failed",
          requested_by: requestedBy,
          created_by: requestedBy,
        }),
      ]);
    }),
  );

  return {
    total: results.length,
    published: results.filter((result) => result.status === "published").length,
    failed: results.filter((result) => result.status === "failed").length,
    queued: results.filter((result) => result.status === "queued").length,
  };
}

export async function refreshPostStatus(admin: AdminClient, postId: string) {
  const { data: targets, error } = await admin
    .from("social_post_targets")
    .select("status")
    .eq("social_post_id", postId);

  if (error) throw new Error(error.message);

  const statuses = (targets ?? []).map((target: any) => target.status);
  const nextStatus = statuses.some((status: string) => status === "failed")
    ? "failed"
    : statuses.some((status: string) => status === "pending" || status === "publishing")
      ? "publishing"
      : "published";

  await admin
    .from("social_posts")
    .update({
      status: nextStatus,
      published_at: nextStatus === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  return nextStatus as "failed" | "publishing" | "published";
}

export async function cloneNextRecurringPost(admin: AdminClient, post: PublishPostRow) {
  const recurrence = (post.recurrence_interval ?? "none") as RecurrenceInterval;
  if (recurrence === "none") return null;

  const [targetResult, assetResult] = await Promise.all([
    admin
      .from("social_post_targets")
      .select("*")
      .eq("organization_id", post.organization_id)
      .eq("social_post_id", post.id),
    admin
      .from("social_media_assets")
      .select("*")
      .eq("organization_id", post.organization_id)
      .eq("social_post_id", post.id),
  ]);

  if (targetResult.error) throw new Error(targetResult.error.message);
  if (assetResult.error) throw new Error(assetResult.error.message);

  const { data: nextPost, error: postError } = await admin
    .from("social_posts")
    .insert({
      organization_id: post.organization_id,
      title: post.title,
      body: post.body,
      status: "scheduled",
      scheduled_at: nextScheduledAt(post.scheduled_at, recurrence),
      recurrence_interval: recurrence,
      created_by: post.created_by,
    })
    .select("id")
    .single();

  if (postError) throw new Error(postError.message);

  const targets = (targetResult.data ?? []).map((target: any) => ({
    organization_id: target.organization_id,
    social_post_id: nextPost.id,
    social_account_id: target.social_account_id,
    platform: target.platform,
    body_override: target.body_override,
    status: "pending",
    created_by: target.created_by,
  }));

  const assets = (assetResult.data ?? []).map((asset: any) => ({
    organization_id: asset.organization_id,
    social_post_id: nextPost.id,
    storage_path: asset.storage_path,
    url: asset.url ?? asset.storage_path,
    provider: asset.provider ?? "imagekit",
    file_id: asset.file_id ?? null,
    media_kind: asset.media_kind ?? "image",
    mime_type: asset.mime_type ?? null,
    size_bytes: asset.size_bytes ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    duration_seconds: asset.duration_seconds ?? null,
    metadata: asset.metadata ?? {},
    created_by: asset.created_by,
  }));

  await Promise.all([
    targets.length > 0 ? admin.from("social_post_targets").insert(targets) : Promise.resolve(),
    assets.length > 0 ? admin.from("social_media_assets").insert(assets) : Promise.resolve(),
  ]);

  return nextPost.id as string;
}
