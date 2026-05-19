import { NextResponse } from "next/server";
import { z } from "zod";
import { SOCIAL_PLATFORM_IDS } from "@/lib/social/platforms";
import { publishSocialPost } from "@/lib/social/publisher";

const targetSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORM_IDS),
  accountId: z.string().min(1),
  accountName: z.string().min(1),
});

const requestSchema = z.object({
  organizationId: z.string().min(1),
  postId: z.string().min(1),
  body: z.string().min(5),
  assetUrl: z.string().url().optional(),
  targets: z.array(targetSchema).min(1),
});

export async function POST(request: Request) {
  const expectedApiKey = process.env.NODE_RED_REWAQ_API_KEY;
  const authorization = request.headers.get("authorization");

  if (expectedApiKey && authorization !== `Bearer ${expectedApiKey}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const results = await publishSocialPost(
    parsed.data.targets.map((target) => ({
      organizationId: parsed.data.organizationId,
      postId: parsed.data.postId,
      body: parsed.data.body,
      assetUrl: parsed.data.assetUrl,
      platform: target.platform,
      accountId: target.accountId,
      accountName: target.accountName,
    })),
  );

  return NextResponse.json({
    ok: results.every((result) => result.status !== "failed"),
    results,
  });
}
