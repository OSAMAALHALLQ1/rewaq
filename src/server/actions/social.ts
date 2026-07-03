"use server";

import { revalidatePath } from "next/cache";
import { demoSocialAccounts } from "@/lib/demo-data";
import { uploadMarketingAssetToImageKit } from "@/lib/imagekit";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getMarketingPublishPreferences, saveMarketingPublishPreferences } from "@/lib/social/preferences";
import { cloneNextRecurringPost, publishTargetsForPost, refreshPostStatus } from "@/lib/social/automation";
import { publishSocialPost } from "@/lib/social/publisher";
import { socialPostSchema } from "@/lib/validation/schemas";
import { can } from "@/lib/permissions/roles";
import { requireAuth } from "@/lib/auth/require-auth";
import type { SocialPlatform } from "@/types/domain";
import type { ActionState } from "./auth";

const isSocialPlatform = (value: string): value is SocialPlatform =>
  demoSocialAccounts.some((account) => account.platform === value);

async function resolveSocialScope() {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("social.ts/resolveSocialScope");

  // Verify user has marketing permission (allow super_admin, organization_owner, marketing_manager, branch_manager, and inventory_manager)
  const allowedRoles = ["super_admin", "organization_owner", "marketing_manager", "branch_manager", "inventory_manager"];
  if (!allowedRoles.includes(auth.role) && !can(auth.role, "marketing:manage")) {
    throw new Error("ليس لديك صلاحية لإدارة التسويق والنشر.");
  }

  // Get organization ID from authenticated user
  if (auth.organizationId) {
    return { admin, organizationId: auth.organizationId, userId: auth.id };
  }

  // Fallback: look up org from membership
  const { data: membership } = await (admin as any)
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", auth.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    return { admin, organizationId: membership.organization_id, userId: auth.id };
  }

  // Last resort: pick the first org (for super_admin roles)
  if (auth.role === "super_admin" || auth.role === "organization_owner") {
    const { data: firstOrg } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstOrg?.id) {
      return { admin, organizationId: firstOrg.id, userId: auth.id };
    }
  }

  throw new Error("لم يتم العثور على مؤسسة مرتبطة بحسابك.");
}

function postStatusForMode(mode: "now" | "schedule" | "draft") {
  if (mode === "now") return "publishing" as const;
  if (mode === "schedule") return "scheduled" as const;
  return "draft" as const;
}

function preparedPostStatusForMode(mode: "now" | "schedule" | "draft") {
  if (mode === "draft") return "draft" as const;
  return "ready" as const;
}

function displayPlatformName(platform: SocialPlatform) {
  if (platform === "facebook") return "Facebook";
  if (platform === "instagram") return "Instagram";
  if (platform === "youtube_shorts") return "YouTube Shorts";
  if (platform === "tiktok") return "TikTok";
  return platform;
}

async function ensureLocalPublisherAccount(
  scope: Awaited<ReturnType<typeof resolveSocialScope>>,
  platform: SocialPlatform,
) {
  const externalAccountId = `local-agent-${platform}`;
  const { data: existing, error: existingError } = await scope.admin
    .from("social_accounts")
    .select("id,account_name")
    .eq("organization_id", scope.organizationId)
    .eq("platform", platform)
    .eq("external_account_id", externalAccountId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return {
      id: existing.id,
      platform,
      accountName: existing.account_name || `${displayPlatformName(platform)} عبر Rewaq Publisher`,
    };
  }

  const { data: created, error } = await scope.admin
    .from("social_accounts")
    .insert({
      organization_id: scope.organizationId,
      platform,
      account_name: `${displayPlatformName(platform)} عبر Rewaq Publisher`,
      external_account_id: externalAccountId,
      status: "local_agent",
      metadata: {
        publishing_mode: "semi_automation",
        requires_human_publish: true,
      },
      created_by: scope.userId,
    })
    .select("id,account_name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: created.id,
    platform,
    accountName: created.account_name || `${displayPlatformName(platform)} عبر Rewaq Publisher`,
  };
}

function recurrenceInterval(value: FormDataEntryValue | null) {
  return value === "daily" || value === "weekly" ? value : "none";
}

export async function saveMarketingPublishPreferencesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const accountIds = formData.getAll("defaultAccountIds").map(String);
  await saveMarketingPublishPreferences(accountIds);
  revalidatePath("/dashboard/marketing");
  revalidatePath("/dashboard/marketing/create");

  return { ok: true, message: "تم حفظ حسابات النشر الدائمة." };
}

export async function createSocialPostAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const accountMode = String(formData.get("accountMode") || "default");
  const oneTimePlatform = String(formData.get("oneTimePlatform") || "");
  const oneTimeAccountName = String(formData.get("oneTimeAccountName") || "").trim();
  const scheduleKind = String(formData.get("scheduleKind") || "manual");
  const mediaKind = String(formData.get("mediaKind") || "text");
  const approvalRequired = formData.get("approvalRequired") === "on";
  const errorPolicy = String(formData.get("errorPolicy") || "retry_failed_only");
  const recurrence = recurrenceInterval(formData.get("recurrenceInterval"));
  const preferences = await getMarketingPublishPreferences();

  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود. لا يمكن حفظ المنشور في قاعدة البيانات." };
  }

  let scope: Awaited<ReturnType<typeof resolveSocialScope>>;
  let selectedAccounts: Array<{ id: string; platform: SocialPlatform; accountName: string }>;

  try {
    scope = await resolveSocialScope();

    if (accountMode === "one_time") {
      if (!isSocialPlatform(oneTimePlatform)) {
        return { ok: false, message: "اختر قناة صحيحة للنشر لمرة واحدة." };
      }

      if (oneTimeAccountName.length < 2) {
        return { ok: false, message: "اكتب اسم الحساب أو المعرف للنشر لمرة واحدة." };
      }

      const { data: oneTimeAccount, error } = await scope.admin
        .from("social_accounts")
        .insert({
          organization_id: scope.organizationId,
          platform: oneTimePlatform,
          account_name: oneTimeAccountName,
          status: "active",
          created_by: scope.userId,
        })
        .select("id,platform,account_name")
        .single();

      if (error) return { ok: false, message: error.message };

      selectedAccounts = [
        {
          id: oneTimeAccount.id,
          platform: oneTimeAccount.platform as SocialPlatform,
          accountName: oneTimeAccount.account_name,
        },
      ];
    } else {
      const { data: accountRows, error } = await scope.admin
        .from("social_accounts")
        .select("id,platform,account_name,status")
        .eq("organization_id", scope.organizationId)
        .eq("status", "active");

      if (error) return { ok: false, message: error.message };

      const submittedPlatforms = formData.getAll("platforms").map(String);
      let accountsToUse = accountRows ?? [];
      
      if (submittedPlatforms.length > 0) {
        const submittedSet = new Set(submittedPlatforms);
        accountsToUse = accountsToUse.filter((account) => submittedSet.has(account.platform));
      } else {
        const preferredIds = new Set(preferences.defaultAccountIds);
        const preferredAccounts = (accountRows ?? []).filter((account) => preferredIds.has(account.id));
        accountsToUse = preferredAccounts.length > 0 ? preferredAccounts : accountRows ?? [];
      }

      selectedAccounts = accountsToUse.map((account) => ({
        id: account.id,
        platform: account.platform as SocialPlatform,
        accountName: account.account_name,
      }));
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذر تجهيز حسابات النشر من Supabase.",
    };
  }

  const platformValues = selectedAccounts.map((account) => account.platform);

  const parsed = socialPostSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    platforms: platformValues,
    publishMode: formData.get("publishMode") || "draft",
    scheduledAt: formData.get("scheduledAt") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات المنشور غير صحيحة" };
  }

  if (selectedAccounts.length === 0) {
    return { ok: false, message: "لا يوجد حساب نشر متصل في Supabase. أضف حسابًا أو استخدم نشر لمرة واحدة." };
  }

  let assetUrl: string | undefined;
  const asset = formData.get("asset");

  if (asset instanceof File && asset.size > 0) {
    try {
      const uploadedAsset = await uploadMarketingAssetToImageKit(asset);
      assetUrl = uploadedAsset?.url;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "تعذر رفع الوسائط إلى ImageKit.",
      };
    }
  }

  const { data: post, error: postError } = await (scope.admin as any)
    .from("social_posts")
    .insert({
      organization_id: scope.organizationId,
      title: parsed.data.title,
      body: parsed.data.body,
      status: postStatusForMode(parsed.data.publishMode),
      scheduled_at: parsed.data.publishMode === "schedule" ? parsed.data.scheduledAt ?? null : null,
      recurrence_interval: recurrence,
      created_by: scope.userId,
    })
    .select("id")
    .single();

  if (postError) return { ok: false, message: postError.message };

  if (assetUrl) {
    await scope.admin.from("social_media_assets").insert({
      organization_id: scope.organizationId,
      social_post_id: post.id,
      storage_path: assetUrl,
      url: assetUrl,
      provider: "imagekit",
      media_kind: mediaKind,
      created_by: scope.userId,
    });
  }

  const targetRows = selectedAccounts.map((account) => ({
    organization_id: scope.organizationId,
    social_post_id: post.id,
    social_account_id: account.id,
    platform: account.platform,
    body_override: String(formData.get(`body_${account.platform}`) || "") || null,
    status: parsed.data.publishMode === "now" ? ("publishing" as const) : ("pending" as const),
    created_by: scope.userId,
  }));

  const { data: targets, error: targetError } = await scope.admin
    .from("social_post_targets")
    .insert(targetRows)
    .select("id,platform,social_account_id");

  if (targetError) return { ok: false, message: targetError.message };

  if (parsed.data.publishMode === "now") {
    const results = await publishSocialPost(
      selectedAccounts.map((account) => ({
        organizationId: scope.organizationId,
        postId: post.id,
        platform: account.platform,
        accountId: account.id,
        accountName: account.accountName,
        body: String(formData.get(`body_${account.platform}`) || parsed.data.body),
        assetUrl,
        mediaKind,
        scheduleKind,
        approvalRequired,
        errorPolicy,
      })),
    );
    const failed = results.filter((result) => result.status === "failed");

    for (const result of results) {
      const target = targets?.find((candidate) => candidate.platform === result.platform);
      const targetStatus = result.status === "queued" ? "publishing" : result.status;

      if (target) {
        await scope.admin
          .from("social_post_targets")
          .update({
            status: targetStatus,
            provider_post_id: result.providerPostId ?? null,
            provider_url: result.providerUrl ?? null,
            error_message: result.error ?? null,
          })
          .eq("id", target.id);
      }

      await scope.admin.from("social_publish_logs").insert({
        organization_id: scope.organizationId,
        social_post_id: post.id,
        target_id: target?.id ?? null,
        social_account_id: target?.social_account_id ?? null,
        platform: result.platform,
        status: targetStatus,
        message: result.error ?? (result.status === "queued" ? "تم وضع النشر في الطابور" : "تم تنفيذ النشر"),
        provider_post_id: result.providerPostId ?? null,
        provider_url: result.providerUrl ?? null,
        error_message: result.error ?? null,
        retryable: result.status === "failed",
        requested_by: scope.userId,
        created_by: scope.userId,
      });
    }

    const postStatus = failed.length > 0 ? "failed" : results.some((result) => result.status === "queued") ? "publishing" : "published";
    await scope.admin
      .from("social_posts")
      .update({
        status: postStatus,
        published_at: postStatus === "published" ? new Date().toISOString() : null,
      })
      .eq("id", post.id);

    if (postStatus === "published" && recurrence !== "none") {
      await cloneNextRecurringPost(scope.admin as any, {
        id: post.id,
        organization_id: scope.organizationId,
        title: parsed.data.title,
        body: parsed.data.body,
        scheduled_at: parsed.data.scheduledAt ?? new Date().toISOString(),
        recurrence_interval: recurrence,
        created_by: scope.userId,
      });
    }

    revalidatePath("/dashboard/marketing");
    revalidatePath("/dashboard/marketing/logs");

    if (failed.length > 0) {
      return {
        ok: true,
        message: `تم النشر جزئيًا. فشلت ${failed.length} منصة وباقي المنصات اكتملت.`,
      };
    }

    if (results.some((result) => result.status === "queued")) {
      return { ok: true, message: "تم إرسال مهمة النشر إلى محرك الخلفية وسيتم تحديث السجل عند اكتمالها." };
    }

    return { ok: true, message: "تم نشر المنشور على كل المنصات المحددة." };
  }

  revalidatePath("/dashboard/marketing");
  revalidatePath("/dashboard/marketing/logs");
  return {
    ok: true,
    message:
      parsed.data.publishMode === "schedule"
        ? `تمت جدولة المنشور بنمط ${scheduleKind}${recurrence !== "none" ? " مع تكرار تلقائي" : ""} وحفظه في Supabase.`
        : approvalRequired
          ? "تم حفظ المنشور بانتظار الموافقة في Supabase."
          : "تم حفظ المنشور كمسودة في Supabase.",
  };
}

export async function createPreparedSocialPostAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState & { postId?: string; assetUrl?: string | null }> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود. لا يمكن حفظ المنشور الجاهز." };
  }

  let scope: Awaited<ReturnType<typeof resolveSocialScope>>;

  try {
    scope = await resolveSocialScope();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذر تجهيز نطاق النشر المحلي.",
    };
  }

  const platforms = formData.getAll("platforms").map(String).filter(isSocialPlatform);
  const publishMode = String(formData.get("publishMode") || "now") as "now" | "schedule" | "draft";
  const scheduledAt = String(formData.get("scheduledAt") || "");
  const parsed = socialPostSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    platforms,
    publishMode,
    scheduledAt: scheduledAt || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات المنشور غير صحيحة" };
  }

  let assetUrl: string | undefined;
  const asset = formData.get("asset");

  if (asset instanceof File && asset.size > 0) {
    try {
      const uploadedAsset = await uploadMarketingAssetToImageKit(asset);
      assetUrl = uploadedAsset?.url;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "تعذر رفع الصورة إلى ImageKit.",
      };
    }
  }

  try {
    const selectedAccounts = await Promise.all(platforms.map((platform) => ensureLocalPublisherAccount(scope, platform)));
    const status = preparedPostStatusForMode(parsed.data.publishMode);

    const { data: post, error: postError } = await (scope.admin as any)
      .from("social_posts")
      .insert({
        organization_id: scope.organizationId,
        title: parsed.data.title,
        body: parsed.data.body,
        status,
        scheduled_at: parsed.data.publishMode === "schedule" ? parsed.data.scheduledAt ?? null : null,
        local_agent_payload: {
          mode: "semi_automation",
          action: "prepare_in_meta_business_suite",
        },
        created_by: scope.userId,
      })
      .select("id")
      .single();

    if (postError) return { ok: false, message: postError.message };

    if (assetUrl) {
      await scope.admin.from("social_media_assets").insert({
        organization_id: scope.organizationId,
        social_post_id: post.id,
        storage_path: assetUrl,
        url: assetUrl,
        provider: "imagekit",
        media_kind: "image",
        created_by: scope.userId,
      });
    }

    const targetRows = selectedAccounts.map((account) => ({
      organization_id: scope.organizationId,
      social_post_id: post.id,
      social_account_id: account.id,
      platform: account.platform,
      status: status === "draft" ? ("pending" as const) : ("ready" as const),
      created_by: scope.userId,
    }));

    const { error: targetError } = await scope.admin.from("social_post_targets").insert(targetRows);
    if (targetError) return { ok: false, message: targetError.message };

    await scope.admin.from("social_publish_logs").insert({
      organization_id: scope.organizationId,
      social_post_id: post.id,
      platform: selectedAccounts[0]?.platform ?? null,
      status: status === "draft" ? "pending" : "ready",
      message:
        status === "draft"
          ? "تم حفظ المنشور كمسودة محلية."
          : "تم تجهيز المنشور للوكيل المحلي بدون استخدام Meta Graph API.",
      requested_by: scope.userId,
      created_by: scope.userId,
    });

    revalidatePath("/dashboard/social-publishing");
    revalidatePath("/dashboard/marketing");

    return {
      ok: true,
      postId: post.id,
      assetUrl: assetUrl ?? null,
      message:
        status === "draft"
          ? "تم حفظ المنشور كمسودة."
          : "تم تجهيز المنشور للنشر اليدوي الذكي. تم نسخ النص ويمكن فتح Meta Business Suite الآن.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذر تجهيز المنشور للنشر المحلي.",
    };
  }
}

export async function markPreparedSocialPostPublishedAction(postId: string): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود. لا يمكن تحديث حالة المنشور." };
  }

  try {
    const scope = await resolveSocialScope();
    const publishedAt = new Date().toISOString();

    const { error: postError } = await scope.admin
      .from("social_posts")
      .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
      .eq("id", postId)
      .eq("organization_id", scope.organizationId);

    if (postError) return { ok: false, message: postError.message };

    const { error: targetError } = await scope.admin
      .from("social_post_targets")
      .update({ status: "published", updated_at: publishedAt })
      .eq("social_post_id", postId)
      .eq("organization_id", scope.organizationId);

    if (targetError) return { ok: false, message: targetError.message };

    await scope.admin.from("social_publish_logs").insert({
      organization_id: scope.organizationId,
      social_post_id: postId,
      status: "published",
      message: "أكد المستخدم أن المنشور تم نشره من Meta Business Suite.",
      requested_by: scope.userId,
      created_by: scope.userId,
    });

    revalidatePath("/dashboard/social-publishing");
    revalidatePath("/dashboard/marketing");
    return { ok: true, message: "تم تحديث حالة المنشور إلى منشور." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذر تحديث حالة المنشور.",
    };
  }
}

export async function retrySocialPostAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود. لا يمكن إعادة النشر." };
  }

  const postId = String(formData.get("postId") || "");
  const targetId = String(formData.get("targetId") || "");

  if (!postId) {
    return { ok: false, message: "منشور غير معروف." };
  }

  try {
    const scope = await resolveSocialScope();

    const { data: post, error: postError } = await (scope.admin as any)
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .eq("organization_id", scope.organizationId)
      .single();

    if (postError || !post) {
      return { ok: false, message: postError?.message ?? "لم يتم العثور على المنشور." };
    }

    let targetQuery = (scope.admin as any)
      .from("social_post_targets")
      .select("*")
      .eq("social_post_id", postId)
      .eq("organization_id", scope.organizationId)
      .eq("status", "failed");

    if (targetId) {
      targetQuery = targetQuery.eq("id", targetId);
    }

    const { data: targets, error: targetError } = await targetQuery;

    if (targetError) {
      return { ok: false, message: targetError.message };
    }

    if (!targets || targets.length === 0) {
      return { ok: false, message: "لا توجد قنوات فاشلة لإعادة المحاولة." };
    }

    await Promise.all(
      targets.map((target: any) =>
        (scope.admin as any)
          .from("social_post_targets")
          .update({ status: "publishing", error_message: null, updated_at: new Date().toISOString() })
          .eq("id", target.id),
      ),
    );

    const summary = await publishTargetsForPost({
      admin: scope.admin as any,
      post,
      targets,
      requestedBy: scope.userId,
    });

    const postStatus = await refreshPostStatus(scope.admin as any, post.id);

    revalidatePath("/dashboard/marketing");
    revalidatePath("/dashboard/marketing/logs");

    if (summary.failed > 0) {
      return {
        ok: true,
        message: `تمت إعادة المحاولة. نجحت ${summary.published} قناة وفشلت ${summary.failed} قناة.`,
      };
    }

    return {
      ok: true,
      message: postStatus === "published" ? "تمت إعادة النشر بنجاح واكتملت كل القنوات." : "تم إرسال إعادة المحاولة إلى محرك الخلفية.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "تعذرت إعادة المحاولة.",
    };
  }
}

export async function connectSocialAccountAction(
  platform: string,
  accountName: string,
  externalAccountId: string = ""
): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود." };
  }

  try {
    const scope = await resolveSocialScope();
    
    // Delete existing account for this platform first
    await scope.admin
      .from("social_accounts")
      .delete()
      .eq("organization_id", scope.organizationId)
      .eq("platform", platform);

    const { error } = await scope.admin
      .from("social_accounts")
      .insert({
        organization_id: scope.organizationId,
        platform,
        account_name: accountName,
        external_account_id: externalAccountId || `ext-${platform}-${Date.now()}`,
        status: externalAccountId.startsWith("local-agent-") ? "local_agent" : "connected",
        created_by: scope.userId,
      });

    if (error) return { ok: false, message: error.message };

    revalidatePath("/dashboard/social-publishing");
    return { ok: true, message: `تم ربط حساب ${platform} بنجاح.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "حدث خطأ أثناء ربط الحساب.",
    };
  }
}

export async function disconnectSocialAccountAction(platform: string): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود." };
  }

  try {
    const scope = await resolveSocialScope();
    
    // If we disconnect facebook, we should also delete linked instagram accounts
    if (platform === "facebook") {
      // Find connected FB page ID first
      const { data: fbAccount } = await scope.admin
        .from("social_accounts")
        .select("external_account_id")
        .eq("organization_id", scope.organizationId)
        .eq("platform", "facebook")
        .eq("status", "connected")
        .maybeSingle();
        
      if (fbAccount?.external_account_id) {
        // Delete instagram account connected to this FB page
        const { data: igAccounts } = await scope.admin
          .from("social_accounts")
          .select("id, metadata")
          .eq("organization_id", scope.organizationId)
          .eq("platform", "instagram");
          
        if (igAccounts) {
          for (const ig of igAccounts) {
            const metadata = (ig.metadata as any) || {};
            if (metadata.facebook_page_id === fbAccount.external_account_id) {
              await scope.admin
                .from("social_accounts")
                .delete()
                .eq("id", ig.id);
            }
          }
        }
      }
    }
    
    const { error } = await scope.admin
      .from("social_accounts")
      .delete()
      .eq("organization_id", scope.organizationId)
      .eq("platform", platform);

    if (error) return { ok: false, message: error.message };

    revalidatePath("/dashboard/social-publishing");
    return { ok: true, message: `تم إلغاء ربط حساب ${platform} بنجاح.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "حدث خطأ أثناء إلغاء ربط الحساب.",
    };
  }
}

export async function activateSocialAccountAction(accountId: string): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود." };
  }

  try {
    const scope = await resolveSocialScope();
    
    // 1. Get the target account
    const { data: targetAccount, error: fetchError } = await scope.admin
      .from("social_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("organization_id", scope.organizationId)
      .single();
      
    if (fetchError || !targetAccount) {
      return { ok: false, message: "لم يتم العثور على الحساب المحدد." };
    }
    
    // 2. Set target Facebook account status to 'connected'
    const { error: updateError } = await scope.admin
      .from("social_accounts")
      .update({ status: "connected" })
      .eq("id", accountId);
      
    if (updateError) return { ok: false, message: updateError.message };
    
    // 3. Set linked Instagram account (if any) status to 'connected'
    if (targetAccount.platform === "facebook") {
      const fbPageId = targetAccount.external_account_id;
      
      // Look up Instagram account where metadata->facebook_page_id matches this Facebook page ID
      const { data: linkedIgAccounts } = await scope.admin
        .from("social_accounts")
        .select("id, metadata")
        .eq("organization_id", scope.organizationId)
        .eq("platform", "instagram");
        
      if (linkedIgAccounts) {
        for (const igAcc of linkedIgAccounts) {
          const metadata = (igAcc.metadata as any) || {};
          if (metadata.facebook_page_id === fbPageId) {
            await scope.admin
              .from("social_accounts")
              .update({ status: "connected" })
              .eq("id", igAcc.id);
          }
        }
      }
    }
    
    // 4. Clean up other disabled/temporary accounts for this platform to keep DB clean
    // (except the newly activated ones)
    const fbPageId = targetAccount.external_account_id;
    
    // Get all accounts that are disabled
    const { data: disabledAccounts } = await scope.admin
      .from("social_accounts")
      .select("id, platform, external_account_id, metadata")
      .eq("organization_id", scope.organizationId)
      .eq("status", "disabled");
      
    if (disabledAccounts) {
      for (const acc of disabledAccounts) {
        let shouldDelete = false;
        
        if (acc.platform === "facebook" && acc.id !== accountId) {
          shouldDelete = true;
        } else if (acc.platform === "instagram") {
          const metadata = (acc.metadata as any) || {};
          if (metadata.facebook_page_id !== fbPageId) {
            shouldDelete = true;
          }
        }
        
        if (shouldDelete) {
          await scope.admin
            .from("social_accounts")
            .delete()
            .eq("id", acc.id);
        }
      }
    }
    
    revalidatePath("/dashboard/social-publishing");
    revalidatePath("/dashboard/marketing");
    return { ok: true, message: "تم تفعيل الحساب والصفحة المرتبطة بنجاح." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "حدث خطأ أثناء تفعيل الحساب.",
    };
  }
}

