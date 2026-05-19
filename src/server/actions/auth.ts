"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendRegistrationRequestNotification } from "@/lib/email/registration-notifications";
import { authSchema, registerSchema, teamInviteSchema } from "@/lib/validation/schemas";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  ok: boolean;
  message: string;
};

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  }

  const isLocalDemoLogin =
    parsed.data.email.toLowerCase() === "owner@rewaq.app" &&
    parsed.data.password === "password123" &&
    process.env.NODE_ENV !== "production";

  if (hasSupabaseEnv() && !isLocalDemoLogin) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { ok: false, message: error.message };
    }

    if (hasSupabaseAdminEnv()) {
      const admin = createAdminClient();
      const { data: approvalRequest } = await admin
        .from("account_approval_requests")
        .select("status")
        .eq("email", parsed.data.email.toLowerCase())
        .maybeSingle();

      if (approvalRequest && String(approvalRequest.status) !== "approved") {
        await supabase.auth.signOut();
        return { ok: false, message: "حسابك لم تتم الموافقة عليه بعد. فعّل بريدك وانتظر موافقة الإدارة." };
      }
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
          organization_name: parsed.data.organizationName,
          business_type: parsed.data.businessType,
          phone: parsed.data.phone,
          approval_status: "pending_owner_approval",
        },
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
  }

  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
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

  return {
    ok: true,
    message: "تم إرسال طلب الحساب. فعّل بريدك الإلكتروني أولًا، ثم يتم اعتماد الحساب من الإدارة قبل فتح لوحة التحكم.",
  };
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

  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.from("team_invites").upsert(
      {
        organization_id: "00000000-0000-4000-8000-000000000001",
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
    const admin = createAdminClient();
    const { error } = await admin
      .from("account_approval_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", requestId);

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  revalidatePath("/admin/account-requests");
  return { ok: true, message: "تمت الموافقة على الحساب. أرسل لصاحب الحساب أن تسجيل الدخول أصبح متاحًا بعد تفعيل البريد." };
}

export async function rejectAccountRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const requestId = String(formData.get("requestId") || "");
  const reason = String(formData.get("reason") || "تم رفض الطلب من الإدارة").trim();

  if (!requestId) {
    return { ok: false, message: "طلب غير معروف" };
  }

  if (hasSupabaseAdminEnv()) {
    const admin = createAdminClient();
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
