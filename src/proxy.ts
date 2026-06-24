import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/supabase/env";
import { jwtVerify } from "jose";

const PROTECTED_PATHS = ["/dashboard"];
const AUTH_PATHS = ["/login", "/register", "/forgot-password"];
const PENDING_PATH = "/pending-approval";

function getApprovalStatus(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  const appStatus = user.app_metadata?.approval_status;
  if (typeof appStatus === "string") {
    return appStatus;
  }

  const userStatus = user.user_metadata?.approval_status;
  return typeof userStatus === "string" ? userStatus : undefined;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Custom Admin Route Protection
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin-login")) {
    const sessionCookie = request.cookies.get("admin_session")?.value;
    
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }

    try {
      const secretKey = process.env.INTERNAL_ADMIN_SECRET;
      if (!secretKey) {
        throw new Error("No secret key configured");
      }
      
      const key = new TextEncoder().encode(secretKey);
      await jwtVerify(sessionCookie, key, { algorithms: ["HS256"] });
      // Valid admin token
    } catch {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }
  }

  let response = await updateSession(request);

  if (!hasSupabaseEnv()) {
    return response;
  }

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const approvalStatus = user ? getApprovalStatus(user) : undefined;
  const isPendingApproval = Boolean(approvalStatus && approvalStatus !== "approved");

  if (user && AUTH_PATHS.some((path) => pathname.startsWith(path)) && !isPendingApproval) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && isPendingApproval && PROTECTED_PATHS.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = PENDING_PATH;
    return NextResponse.redirect(url);
  }

  if (user && !isPendingApproval && pathname.startsWith(PENDING_PATH)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && PROTECTED_PATHS.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/(?:node-red|n8n)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
