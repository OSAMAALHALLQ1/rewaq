import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth/admin-session";
import {
  adminClientFingerprint,
  checkAdminLoginRateLimit,
  getConfiguredAdminCredentials,
  recordAdminLoginResult,
  verifyConfiguredAdminCredentials,
} from "@/lib/auth/admin-credentials";

const GENERIC_ADMIN_ERROR = "تعذر تسجيل الدخول إلى بوابة الإدارة.";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const secret = process.env.INTERNAL_ADMIN_SECRET;
    const configuredCredentials = getConfiguredAdminCredentials();

    if (!configuredCredentials || !secret || secret.length < 32) {
      return NextResponse.json(
        { error: "بوابة الإدارة غير مهيأة بأسرار الخادم المطلوبة." },
        { status: 503 },
      );
    }

    const fingerprint = adminClientFingerprint(request, secret);
    const rateLimit = checkAdminLoginRateLimit(fingerprint);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    if (
      username.length > 120 ||
      password.length > 512 ||
      !verifyConfiguredAdminCredentials(username, password)
    ) {
      recordAdminLoginResult(fingerprint, false);
      return NextResponse.json({ error: GENERIC_ADMIN_ERROR }, { status: 401 });
    }

    recordAdminLoginResult(fingerprint, true);
    try {
      await createAdminSession(username);
    } catch (error) {
      console.error("[admin-session]", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: GENERIC_ADMIN_ERROR }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: GENERIC_ADMIN_ERROR }, { status: 500 });
  }
}
