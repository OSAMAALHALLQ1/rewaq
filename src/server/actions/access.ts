"use server";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  employeeCodeLoginSchema,
  ownerPasswordLoginSchema,
} from "@/lib/validation/access";

export type AccessActionState = {
  ok: boolean;
  message: string;
};

const GENERIC_LOGIN_ERROR = "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.";

export async function ownerPasswordLoginAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = ownerPasswordLoginSchema.safeParse({
    password: formData.get("password"),
  });
  const ownerEmail = (
    process.env.RAWAQ_OWNER_EMAIL ?? process.env.ADMIN_REGISTRATION_EMAIL
  )
    ?.trim()
    .toLowerCase();

  if (!parsed.success || !ownerEmail || !hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ownerEmail,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await supabase.auth.signOut();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const admin = createAdminClient();
  const [{ data: memberships, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      (admin as any)
        .from("organization_memberships")
        .select("role")
        .eq("user_id", data.user.id),
      (admin as any)
        .from("profiles")
        .select("status")
        .eq("id", data.user.id)
        .maybeSingle(),
    ]);
  const isOwner = (memberships ?? []).some(
    (membership: { role?: string }) =>
      membership.role === "organization_owner" || membership.role === "super_admin",
  );
  const approvalStatus =
    typeof data.user.app_metadata?.approval_status === "string"
      ? data.user.app_metadata.approval_status
      : undefined;

  if (
    membershipError ||
    profileError ||
    !isOwner ||
    (profile && String(profile.status) !== "approved") ||
    (approvalStatus && approvalStatus !== "approved")
  ) {
    await supabase.auth.signOut();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  redirect("/dashboard");
}

// Employees sign in with their code only. The actual Supabase password is a
// server-side secret derived from the code — it never leaves the server and
// is never shown to anyone. Revoking the invite immediately blocks login.
function deriveEmployeePassword(inviteCode: string): string | null {
  const secret = process.env.INTERNAL_ADMIN_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`rewaq:employee-code-login:${inviteCode}`)
    .digest("hex");
}

export async function employeeCodeLoginAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = employeeCodeLoginSchema.safeParse({
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success || !hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const derivedPassword = deriveEmployeePassword(parsed.data.inviteCode);
  if (!derivedPassword) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await (admin as any)
    .from("team_invites")
    .select("id,email,status,expires_at,accepted_user_id,revoked_at")
    .eq("invite_code", parsed.data.inviteCode)
    .maybeSingle();
  const pendingExpired =
    invite?.status === "pending" &&
    (!invite.expires_at || new Date(invite.expires_at).getTime() <= Date.now());

  if (
    inviteError ||
    !invite ||
    invite.revoked_at ||
    pendingExpired ||
    !["pending", "accepted"].includes(String(invite.status))
  ) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();
  const inviteEmail = String(invite.email).toLowerCase();
  let userId =
    typeof invite.accepted_user_id === "string" ? invite.accepted_user_id : null;

  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email: inviteEmail,
      password: derivedPassword,
      email_confirm: true,
      app_metadata: {
        approval_status: "approved",
        login_source: "employee_code",
      },
    });
    userId = created.data.user?.id ?? null;

    if (created.error || !userId) {
      const existing = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password: derivedPassword,
      });
      userId = existing.data.user?.id ?? null;
      if (existing.error || !userId) {
        await supabase.auth.signOut();
        return { ok: false, message: GENERIC_LOGIN_ERROR };
      }
    }
  }

  let signedIn = await supabase.auth.signInWithPassword({
    email: inviteEmail,
    password: derivedPassword,
  });

  // Employee accounts created before code-only login still carry a
  // self-chosen password: rotate it to the derived secret once, then retry.
  if (signedIn.error && userId) {
    const rotated = await admin.auth.admin.updateUserById(userId, {
      password: derivedPassword,
    });
    if (!rotated.error) {
      signedIn = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password: derivedPassword,
      });
    }
  }

  if (signedIn.error || !signedIn.data.user || signedIn.data.user.id !== userId) {
    await supabase.auth.signOut();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const { error: acceptError } = await (admin as any).rpc(
    "accept_team_invite_by_code",
    {
      p_invite_code: parsed.data.inviteCode,
      p_user_id: signedIn.data.user.id,
    },
  );

  if (acceptError) {
    await supabase.auth.signOut();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  redirect("/dashboard");
}
