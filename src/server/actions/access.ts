"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  fingerprintEmployeeLoginClient,
  hashEmployeeCode,
} from "@/lib/auth/employee-code";
import { roleHomePath } from "@/lib/auth/route-access";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { employeeCodeLoginSchema } from "@/lib/validation/access";
import type { Json } from "@/types/database";
import type { Role } from "@/types/domain";

export type AccessActionState = {
  ok: boolean;
  message: string;
};

const GENERIC_LOGIN_ERROR = "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.";
const RATE_LIMIT_ERROR =
  "تم إيقاف محاولات الدخول مؤقتًا لحماية الحساب. انتظر قليلًا ثم حاول مجددًا.";

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

type LoginGateResult = {
  allowed?: boolean;
  retry_after_seconds?: number;
};

async function getEmployeeClientFingerprint(secret: string): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwardedFor ||
    requestHeaders.get("x-real-ip")?.trim() ||
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    "unknown-address";
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) || "unknown-agent";

  return fingerprintEmployeeLoginClient(`${address}|${userAgent}`, secret);
}

async function recordEmployeeLoginResult(
  admin: ReturnType<typeof createAdminClient>,
  codeHash: string,
  clientFingerprint: string,
  succeeded: boolean,
) {
  const { error } = await admin.rpc("record_employee_code_login_result", {
    p_code_hash: codeHash,
    p_client_fingerprint: clientFingerprint,
    p_succeeded: succeeded,
  });

  if (error) {
    console.error("[employee-login-audit]", error.message);
  }
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

  const secret = process.env.INTERNAL_ADMIN_SECRET?.trim();
  if (!secret) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const derivedPassword = deriveEmployeePassword(parsed.data.inviteCode);
  if (!derivedPassword) {
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const admin = createAdminClient();
  const codeHash = hashEmployeeCode(parsed.data.inviteCode);
  const clientFingerprint = await getEmployeeClientFingerprint(secret);
  const { data: gateData, error: gateError } = await admin.rpc(
    "begin_employee_code_login",
    {
      p_code_hash: codeHash,
      p_client_fingerprint: clientFingerprint,
    },
  );

  if (gateError) {
    console.error("[employee-login-rate-limit]", gateError.message);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const gate = (gateData ?? {}) as Json as LoginGateResult;
  if (!gate.allowed) {
    return { ok: false, message: RATE_LIMIT_ERROR };
  }

  const { data: invite, error: inviteError } = await admin
    .from("team_invites")
    .select(
      "id,organization_id,email,role,status,expires_at,accepted_user_id,revoked_at",
    )
    .eq("invite_code", codeHash)
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
    await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();
  const inviteEmail = String(invite.email).toLowerCase();
  let userId =
    typeof invite.accepted_user_id === "string" ? invite.accepted_user_id : null;

  if (!userId) {
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", inviteEmail)
      .maybeSingle();

    if (profileLookupError) {
      await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
      return { ok: false, message: GENERIC_LOGIN_ERROR };
    }

    if (existingProfile?.id) {
      const { data: existingMembership, error: membershipError } = await admin
        .from("organization_memberships")
        .select("organization_id,role")
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (
        membershipError ||
        !existingMembership ||
        existingMembership.organization_id !== invite.organization_id ||
        ["organization_owner", "super_admin"].includes(existingMembership.role)
      ) {
        await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
        return { ok: false, message: GENERIC_LOGIN_ERROR };
      }

      userId = existingProfile.id;
    } else {
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
        await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
        return { ok: false, message: GENERIC_LOGIN_ERROR };
      }
    }
  }

  if (!userId) {
    await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  // Re-derive on each successful code proof so rotating INTERNAL_ADMIN_SECRET
  // does not strand legitimate employee accounts. The accepted_user_id/email
  // checks above prevent this path from rotating an owner or unrelated user.
  const rotated = await admin.auth.admin.updateUserById(userId, {
    password: derivedPassword,
  });
  if (rotated.error) {
    await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const signedIn = await supabase.auth.signInWithPassword({
    email: inviteEmail,
    password: derivedPassword,
  });

  if (signedIn.error || !signedIn.data.user || signedIn.data.user.id !== userId) {
    await supabase.auth.signOut();
    await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  const { error: acceptError } = await admin.rpc(
    "accept_team_invite_by_code",
    {
      p_invite_code: codeHash,
      p_user_id: signedIn.data.user.id,
    },
  );

  if (acceptError) {
    await supabase.auth.signOut();
    await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  await recordEmployeeLoginResult(admin, codeHash, clientFingerprint, true);
  redirect(roleHomePath(invite.role as Role));
}
