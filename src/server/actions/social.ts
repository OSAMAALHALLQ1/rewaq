"use server";

import { revalidatePath } from "next/cache";
import { demoOrganization, demoSocialAccounts } from "@/lib/demo-data";
import { publishSocialPost } from "@/lib/social/publisher";
import { socialPostSchema } from "@/lib/validation/schemas";
import type { ActionState } from "./auth";

export async function createSocialPostAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const platforms = formData.getAll("platforms").map(String);
  const parsed = socialPostSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    platforms,
    publishMode: formData.get("publishMode") || "draft",
    scheduledAt: formData.get("scheduledAt") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات المنشور غير صحيحة" };
  }

  if (parsed.data.publishMode === "now") {
    const selectedAccounts = demoSocialAccounts.filter((account) =>
      parsed.data.platforms.includes(account.platform as "facebook" | "instagram" | "telegram"),
    );

    const results = await publishSocialPost(
      selectedAccounts.map((account) => ({
        organizationId: demoOrganization.id,
        postId: `post_${Date.now()}`,
        platform: account.platform,
        accountId: account.id,
        accountName: account.accountName,
        body: parsed.data.body,
      })),
    );

    const failed = results.filter((result) => result.status === "failed");
    revalidatePath("/dashboard/marketing");
    revalidatePath("/dashboard/marketing/logs");

    if (failed.length > 0) {
      return {
        ok: true,
        message: `تم النشر جزئيًا. فشلت ${failed.length} منصة وباقي المنصات اكتملت.`,
      };
    }

    return { ok: true, message: "تم نشر المنشور على كل المنصات المحددة." };
  }

  revalidatePath("/dashboard/marketing");
  return {
    ok: true,
    message: parsed.data.publishMode === "schedule" ? "تمت جدولة المنشور." : "تم حفظ المنشور كمسودة.",
  };
}
