import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/require-auth";
import { createAdminClientWithContext } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const auth = await requireAuth();

    // 2. Parse query parameters
    const requestUrl = new URL(request.url);
    const platform = requestUrl.searchParams.get("platform") || "facebook";

    if (platform !== "facebook" && platform !== "instagram") {
      return NextResponse.json(
        { error: "Platform not supported. Currently only Facebook and Instagram are supported." },
        { status: 400 }
      );
    }

    // 3. Resolve organization ID
    const admin = createAdminClientWithContext("social/oauth/connect");

    const organizationId = auth.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "No organization associated with your account." },
        { status: 400 }
      );
    }

    // 4. Production requires a complete Meta application and public callback URL.
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NODE_ENV === "production" && (!clientId || !clientSecret || !configuredAppUrl)) {
      return NextResponse.json({ error: "إعداد ربط Meta غير مكتمل." }, { status: 503 });
    }
    // 5. Generate secure state
    const state = crypto.randomBytes(16).toString("hex");

    // 6. Insert state in database
    const { error: stateError } = await admin
      .from("social_oauth_states")
      .insert({
        organization_id: organizationId,
        platform: platform,
        state: state,
        requested_scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "instagram_basic", "instagram_content_publish"],
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins
        created_by: auth.id
      });

    if (stateError) {
      console.error("Failed to insert OAuth state:", stateError);
      return NextResponse.json(
        { error: `Database error: ${stateError.message}` },
        { status: 500 }
      );
    }

    // 7. Build Meta OAuth redirect URL
    const appUrl = configuredAppUrl || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/social/oauth/callback`;

    // If client ID is not configured in .env, redirect directly to callback with 'mock' code for developer testing
    if (!clientId) {
      console.warn("FACEBOOK_CLIENT_ID is not configured. Redirecting to developer mock flow outside production.");
      return NextResponse.redirect(`${redirectUri}?code=mock&state=${state}`);
    }

    const scopes = [
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
      "instagram_basic",
      "instagram_content_publish"
    ].join(",");

    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}`;

    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error("OAuth connect error:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard/social-publishing?error=oauth_init_failed`);
  }
}
