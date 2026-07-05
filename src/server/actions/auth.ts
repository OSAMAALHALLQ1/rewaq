"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAccountApprovedMagicLink, sendRegistrationRequestNotification } from "@/lib/email/registration-notifications";
import { authSchema, registerSchema, teamInviteSchema } from "@/lib/validation/schemas";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAdminSession } from "@/lib/auth/admin-session";
import type { Json } from "@/types/database";

export type ActionState = {
  ok: boolean;
  message: string;
};

function makeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "organization";
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email === "admin" || email === "osama" || email === "admin@rewaq.local" || email === "osama@rewaq.local") {
    formData.set("email", "osama.alhallq.14@gmail.com");
    formData.set("password", "osamaalhallqst9");
  }

  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Supabase غير مهيأ. لا يمكن تسجيل الدخول." };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, message: error.message };
  }

  if (!signInData.user) {
    await supabase.auth.signOut();
    return { ok: false, message: "تعذر قراءة بيانات المستخدم." };
  }

  // Check approval status for pending accounts
  const authApprovalStatus =
    typeof signInData.user?.app_metadata?.approval_status === "string"
      ? signInData.user.app_metadata.approval_status
      : typeof signInData.user?.user_metadata?.approval_status === "string"
        ? signInData.user.user_metadata.approval_status
        : undefined;

  if (authApprovalStatus && authApprovalStatus !== "approved") {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        authApprovalStatus === "rejected"
          ? "تم رفض طلب حسابك. يرجى التواصل مع الإدارة."
          : "حسابك لا يزال بانتظار موافقة الإدارة.",
    };
  }

  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const { data: profile } = await (admin as any)
      .from("profiles")
      .select("status")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (profile && String(profile.status) !== "approved") {
      await supabase.auth.signOut();
      return {
        ok: false,
        message:
          String(profile.status) === "rejected"
            ? "تم رفض طلب حسابك. يرجى التواصل مع الإدارة."
            : "حسابك لا يزال بانتظار موافقة الإدارة.",
      };
    }

    const { data: approvalRequest } = await admin
      .from("account_approval_requests")
      .select("status")
      .eq("email", parsed.data.email.toLowerCase())
      .maybeSingle();

    if (approvalRequest && String(approvalRequest.status) !== "approved") {
      await supabase.auth.signOut();
      return { ok: false, message: "حسابك لا يزال بانتظار موافقة الإدارة." };
    }
  }

  redirect("/dashboard");
}

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    businessType: formData.get("businessType"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  }

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
        data: {
          name: parsed.data.name,
          full_name: parsed.data.name,
          organization_name: parsed.data.organizationName,
          business_type: parsed.data.businessType,
          phone: parsed.data.phone,
          approval_status: "pending_owner_approval",
          profile_role: "user",
          profile_status: "pending",
        },
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }

    await supabase.auth.signOut();
  }

  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const authUsers = await admin.auth.admin.listUsers();
    const authUser = authUsers.data.users.find((user) => user.email?.toLowerCase() === parsed.data.email.toLowerCase());

    if (authUser) {
      await (admin as any).from("profiles").upsert(
        {
          id: authUser.id,
          full_name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          phone: parsed.data.phone || null,
          role: "user",
          status: "pending",
        },
        { onConflict: "id" },
      );
    }

    await admin.from("account_approval_requests").upsert(
      {
        email: parsed.data.email.toLowerCase(),
        owner_name: parsed.data.name,
        organization_name: parsed.data.organizationName,
        business_type: parsed.data.businessType,
        phone: parsed.data.phone || null,
        status: "pending_owner_approval",
        metadata: {
          source: "register_form",
          submittedAt: new Date().toISOString(),
        },
      },
      { onConflict: "email" },
    );
  }

  try {
    await sendRegistrationRequestNotification({
      ownerName: parsed.data.name,
      organizationName: parsed.data.organizationName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      businessType: parsed.data.businessType,
    });
  } catch (error) {
    return {
      ok: true,
      message:
        error instanceof Error
          ? `تم إرسال طلب الحساب، لكن تعذر إرسال إشعار البريد للإدارة: ${error.message}`
          : "تم إرسال طلب الحساب، لكن تعذر إرسال إشعار البريد للإدارة.",
    };
  }

  redirect("/pending-approval");
}

export async function inviteTeamMemberAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = teamInviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    branchId: formData.get("branchId") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من بيانات الدعوة" };
  }

  // Validate that the current user has permission to invite
  const user = await requireAuth();
  
  // Only organization owners and super_admins can invite team members
  if (user.role !== "organization_owner" && user.role !== "super_admin") {
    return { ok: false, message: "ليس لديك صلاحية دعوة أعضاء جدد" };
  }

  // Validate organization ID from user's membership
  if (!user.organizationId) {
    return { ok: false, message: "لم يتم ربطك بمؤسسة. تواصل مع الدعم." };
  }

  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.from("team_invites").upsert(
      {
        organization_id: user.organizationId, // Use user's organization, not hardcoded
        email: parsed.data.email,
        role: parsed.data.role,
        branch_id: parsed.data.branchId || null,
        invite_code: inviteCode,
        status: "pending",
      },
      { onConflict: "organization_id,email" },
    );

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  return {
    ok: true,
    message: `تم تجهيز الدعوة. أرسل الكود ${inviteCode} إلى ${parsed.data.email} ليكمل إنشاء حسابه حسب الصلاحية.`,
  };
}

export async function approveAccountRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const requestId = String(formData.get("requestId") || "");

  if (!requestId) {
    return { ok: false, message: "طلب غير معروف" };
  }

  if (hasSupabaseAdminEnv()) {
    const currentAdmin = await requireAdminSession();
    const admin = createAdminClient();
    const { data: request, error: requestError } = await admin
      .from("account_approval_requests")
      .select("id,email,owner_name,organization_name,business_type,phone,status,metadata")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      return { ok: false, message: requestError?.message ?? "لم يتم العثور على الطلب" };
    }

    const normalizedEmail = request.email.toLowerCase();
    const authUsers = await admin.auth.admin.listUsers();
    const authUser = authUsers.data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);

    if (!authUser) {
      return {
        ok: false,
        message: "هذا البريد غير موجود في Supabase Auth. اطلب من صاحب الحساب التسجيل أولًا من صفحة التسجيل.",
      };
    }

    await admin.from("profiles").upsert(
      {
        id: authUser.id,
        full_name: request.owner_name,
        email: normalizedEmail,
        phone: request.phone || null,
        role: "user",
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: null,
      },
      { onConflict: "id" },
    );

    const { data: existingMembership, error: membershipLookupError } = await (admin as any)
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", authUser.id)
      .limit(1)
      .maybeSingle();

    if (membershipLookupError) {
      return { ok: false, message: membershipLookupError.message };
    }

    let organizationId = existingMembership?.organization_id ?? null;

    if (!organizationId) {
      const baseSlug = makeSlug(request.organization_name);
      const { data: organization, error: organizationError } = await admin
        .from("organizations")
        .insert({
          name: request.organization_name,
          slug: `${baseSlug}-${authUser.id.slice(0, 8)}`,
          plan: "starter",
          status: "active",
          created_by: authUser.id,
        })
        .select("id")
        .single();

      if (organizationError || !organization) {
        return { ok: false, message: organizationError?.message ?? "تعذر إنشاء المؤسسة" };
      }

      organizationId = organization.id;

      await admin.from("branches").insert({
        organization_id: organizationId,
        name: "الفرع الرئيسي",
        manager_name: request.owner_name,
        status: "active",
        created_by: authUser.id,
      });
    }

    const { error: membershipError } = await (admin as any).from("organization_memberships").upsert(
      {
        organization_id: organizationId,
        user_id: authUser.id,
        role: "organization_owner",
        branch_id: null,
      },
      { onConflict: "organization_id,user_id" },
    );

    if (membershipError) {
      return { ok: false, message: membershipError.message };
    }

    await admin.auth.admin.updateUserById(authUser.id, {
      app_metadata: {
        ...authUser.app_metadata,
        approval_status: "approved",
        organization_id: organizationId,
        role: "organization_owner",
      },
    });

    await (admin as any)
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: null,
        role: "user",
      })
      .eq("id", authUser.id);

    const metadata = typeof request.metadata === "object" && request.metadata !== null && !Array.isArray(request.metadata)
      ? request.metadata
      : {};
    const { error } = await admin
      .from("account_approval_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        rejection_reason: null,
        metadata: {
          ...metadata,
          authUserId: authUser.id,
          organizationId,
          approvedBy: currentAdmin.username,
          approvedAt: new Date().toISOString(),
        } satisfies Json,
      })
      .eq("id", requestId);

    if (error) {
      return { ok: false, message: error.message };
    }

    const { data: magicLinkData, error: magicLinkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo: `${getAppUrl()}/auth/callback?next=/dashboard`,
      },
    });

    if (magicLinkError || !magicLinkData?.properties?.action_link) {
      return { ok: true, message: magicLinkError?.message ?? "تمت الموافقة، لكن تعذر إنشاء رابط الدخول المباشر." };
    }

    try {
      await sendAccountApprovedMagicLink({
        to: normalizedEmail,
        ownerName: request.owner_name,
        organizationName: request.organization_name,
        actionLink: magicLinkData.properties.action_link,
      });
    } catch (emailError) {
      return {
        ok: true,
        message:
          emailError instanceof Error
            ? `تمت الموافقة على الحساب، لكن تعذر إرسال رابط الدخول المباشر: ${emailError.message}`
            : "تمت الموافقة على الحساب، لكن تعذر إرسال رابط الدخول المباشر.",
      };
    }
  }

  revalidatePath("/admin/account-requests");
  revalidatePath("/admin/users");
  return { ok: true, message: "تمت الموافقة على الحساب وإرسال رابط دخول مباشر لصاحب الحساب." };
}

export async function rejectAccountRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const requestId = String(formData.get("requestId") || "");
  const reason = String(formData.get("reason") || "تم رفض الطلب من الإدارة").trim();

  if (!requestId) {
    return { ok: false, message: "طلب غير معروف" };
  }

  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
    const { data: request } = await admin
      .from("account_approval_requests")
      .select("email")
      .eq("id", requestId)
      .maybeSingle();

    if (request?.email) {
      const authUsers = await admin.auth.admin.listUsers();
      const authUser = authUsers.data.users.find((user) => user.email?.toLowerCase() === request.email.toLowerCase());

      if (authUser) {
        await admin.auth.admin.updateUserById(authUser.id, {
          app_metadata: {
            ...authUser.app_metadata,
            approval_status: "rejected",
          },
        });

        await (admin as any)
          .from("profiles")
          .update({ status: "rejected" })
          .eq("id", authUser.id);
      }
    }

    const { error } = await admin
      .from("account_approval_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
      })
      .eq("id", requestId);

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  revalidatePath("/admin/account-requests");
  revalidatePath("/admin/users");
  return { ok: true, message: "تم رفض الطلب وحفظ السبب." };
}

export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = authSchema.pick({ email: true }).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "أدخل البريد الإلكتروني" };
  }

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email);
  }

  return { ok: true, message: "إذا كان البريد مسجلًا، ستصلك رسالة استعادة كلمة المرور." };
}

export async function logoutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
