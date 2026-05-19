import "server-only";
import { cookies } from "next/headers";
import { demoSocialAccounts } from "@/lib/demo-data";
import type { SocialPlatform } from "@/types/domain";

const COOKIE_NAME = "rewaq_marketing_publish_preferences";

export type MarketingPublishPreferences = {
  defaultAccountIds: string[];
};

export async function getMarketingPublishPreferences(): Promise<MarketingPublishPreferences> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MarketingPublishPreferences;
      return {
        defaultAccountIds: Array.isArray(parsed.defaultAccountIds) ? parsed.defaultAccountIds.map(String).filter(Boolean) : [],
      };
    } catch {
      // Invalid cookies should not block the marketing workflow.
    }
  }

  return {
    defaultAccountIds: demoSocialAccounts
      .filter((account) => account.status === "connected")
      .map((account) => account.id),
  };
}

export async function saveMarketingPublishPreferences(defaultAccountIds: string[]) {
  const cookieStore = await cookies();
  const cleanedIds = defaultAccountIds.map(String).filter(Boolean);

  cookieStore.set(COOKIE_NAME, JSON.stringify({ defaultAccountIds: cleanedIds }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function getDefaultPlatforms(defaultAccountIds: string[]): SocialPlatform[] {
  return demoSocialAccounts
    .filter((account) => defaultAccountIds.includes(account.id))
    .map((account) => account.platform);
}
