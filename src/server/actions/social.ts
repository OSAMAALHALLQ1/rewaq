"use server";

import { revalidatePath } from "next/cache";
import { demoSocialAccounts } from "@/lib/demo-data";
import { uploadMarketingAssetToImageKit } from "@/lib/imagekit";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getMarketingPublishPreferences, saveMarketingPublishPreferences } from "@/lib/social/preferences";
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

      const preferredIds = new Set(preferences.defaultAccountIds);
      const preferredAccounts = (accountRows ?? []).filter((account) => preferredIds.has(account.id));
      const accountsToUse = preferredAccounts.length > 0 ? preferredAccounts : accountRows ?? [];

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

  const { data: post, error: postError } = await scope.admin
    .from("social_posts")
    .insert({
      organization_id: scope.organizationId,
      title: parsed.data.title,
      body: parsed.data.body,
      status: postStatusForMode(parsed.data.publishMode),
      scheduled_at: parsed.data.publishMode === "schedule" ? parsed.data.scheduledAt ?? null : null,
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
        ? `تمت جدولة المنشور بنمط ${scheduleKind} وحفظه في Supabase.`
        : approvalRequired
          ? "تم حفظ المنشور بانتظار الموافقة في Supabase."
          : "تم حفظ المنشور كمسودة في Supabase.",
  };
}
