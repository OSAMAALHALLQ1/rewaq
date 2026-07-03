import { NextResponse } from "next/server";
import { createAdminClientWithContext } from "@/lib/supabase/admin";

const ALLOWED_STATUS_UPDATES = new Set(["ready", "prepared", "published", "failed"]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized local publisher request." }, { status: 401 });
}

function validateAgentRequest(request: Request) {
  const expectedToken = process.env.REWAQ_PUBLISHER_AGENT_TOKEN;
  if (!expectedToken) return true;

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expectedToken}`;
}

export async function GET(request: Request) {
  if (!validateAgentRequest(request)) return unauthorized();

  const requestUrl = new URL(request.url);
  const organizationId = requestUrl.searchParams.get("organizationId");
  const admin = createAdminClientWithContext("local-publisher/posts:get");
  const now = new Date().toISOString();

  let postQuery = (admin as any)
    .from("social_posts")
    .select("id,organization_id,title,body,status,scheduled_at,created_at,image_local_path,local_agent_payload")
    .in("status", ["ready", "prepared"])
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (organizationId) {
    postQuery = postQuery.eq("organization_id", organizationId);
  }

  const { data: posts, error } = await postQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const post = posts?.[0];
  if (!post) {
    return NextResponse.json({ post: null });
  }

  const [{ data: targets }, { data: assets }] = await Promise.all([
    admin
      .from("social_post_targets")
      .select("id,platform,status,provider_post_id,provider_url,error_message")
      .eq("social_post_id", post.id)
      .eq("organization_id", post.organization_id),
    admin
      .from("social_media_assets")
      .select("id,url,storage_path,media_kind,mime_type")
      .eq("social_post_id", post.id)
      .eq("organization_id", post.organization_id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    post: {
      id: post.id,
      organizationId: post.organization_id,
      title: post.title,
      caption: post.body,
      status: post.status,
      scheduledAt: post.scheduled_at,
      createdAt: post.created_at,
      imageUrl: assets?.[0]?.url || assets?.[0]?.storage_path || null,
      imageLocalPath: post.image_local_path || null,
      platforms: (targets ?? []).map((target) => target.platform),
      targets: targets ?? [],
      metaBusinessSuiteUrl: "https://business.facebook.com/latest/composer",
    },
  });
}

export async function PATCH(request: Request) {
  if (!validateAgentRequest(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  const postId = String(body?.postId || "");
  const status = String(body?.status || "");
  const providerPostId = body?.metaPostId ? String(body.metaPostId) : null;
  const providerUrl = body?.metaPostUrl ? String(body.metaPostUrl) : null;
  const errorMessage = body?.error ? String(body.error) : null;

  if (!postId || !ALLOWED_STATUS_UPDATES.has(status)) {
    return NextResponse.json({ error: "postId and a valid status are required." }, { status: 400 });
  }

  const admin = createAdminClientWithContext("local-publisher/posts:patch");
  const updatedAt = new Date().toISOString();

  const { data: post, error: postFetchError } = await admin
    .from("social_posts")
    .select("id,organization_id")
    .eq("id", postId)
    .single();

  if (postFetchError || !post) {
    return NextResponse.json({ error: postFetchError?.message || "Post not found." }, { status: 404 });
  }

  const { error: postError } = await admin
    .from("social_posts")
    .update({
      status,
      published_at: status === "published" ? updatedAt : null,
      updated_at: updatedAt,
    })
    .eq("id", postId);

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });

  const targetStatus = status === "ready" ? "ready" : status === "prepared" ? "prepared" : status === "published" ? "published" : "failed";
  const { error: targetError } = await admin
    .from("social_post_targets")
    .update({
      status: targetStatus,
      provider_post_id: providerPostId,
      provider_url: providerUrl,
      error_message: errorMessage,
      updated_at: updatedAt,
    })
    .eq("social_post_id", postId);

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });

  await admin.from("social_publish_logs").insert({
    organization_id: post.organization_id,
    social_post_id: postId,
    status: targetStatus,
    message: errorMessage || `Local publisher marked post as ${status}.`,
    provider_post_id: providerPostId,
    provider_url: providerUrl,
    error_message: errorMessage,
    created_by: null,
  });

  return NextResponse.json({ ok: true });
}
