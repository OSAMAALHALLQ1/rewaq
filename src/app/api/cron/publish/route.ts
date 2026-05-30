import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { cloneNextRecurringPost, publishTargetsForPost, refreshPostStatus } from "@/lib/social/automation";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase admin env is missing." }, { status: 500 });
  }

  const admin = createAdminClient() as any;
  const now = new Date().toISOString();

  const { data: posts, error } = await admin
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const summaries = await Promise.all(
    (posts ?? []).map(async (post: any) => {
      const { data: targets, error: targetError } = await admin
        .from("social_post_targets")
        .select("*")
        .eq("organization_id", post.organization_id)
        .eq("social_post_id", post.id)
        .in("status", ["pending", "failed"]);

      if (targetError) {
        throw new Error(targetError.message);
      }

      await admin
        .from("social_posts")
        .update({ status: "publishing", updated_at: new Date().toISOString() })
        .eq("id", post.id);

      const summary = await publishTargetsForPost({
        admin,
        post,
        targets: targets ?? [],
        requestedBy: post.created_by ?? null,
      });

      const status = await refreshPostStatus(admin, post.id);
      const nextPostId = status === "published" ? await cloneNextRecurringPost(admin, post) : null;

      return {
        postId: post.id,
        status,
        nextPostId,
        ...summary,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    processed: summaries.length,
    summaries,
  });
}
