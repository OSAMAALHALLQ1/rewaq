import type { PublishInput, PublishResult, SocialPublisher } from "./types";

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY ?? "B1999FE8-177E4B10-A80ED722-B821C15F";

export class AyrsharePublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    try {
      // Map Rawaq platforms to Ayrshare platform IDs
      const platformMap: Record<string, string> = {
        facebook: "facebook",
        instagram: "instagram",
        tiktok: "tiktok",
        youtube_shorts: "youtube",
        x: "twitter",
        google_business: "gmb",
        linkedin: "linkedin",
        pinterest: "pinterest",
        telegram: "telegram"
      };

      const ayrPlatform = platformMap[input.platform];
      if (!ayrPlatform) {
        return {
          platform: input.platform,
          status: "failed",
          error: `المنصة ${input.platform} غير مدعومة حالياً عبر موصل Ayrshare.`
        };
      }

      // Build payload
      const payload: any = {
        post: input.body,
        platforms: [ayrPlatform]
      };

      if (input.assetUrl) {
        payload.mediaUrls = [input.assetUrl];
      }

      // Make API Request to Ayrshare
      const response = await fetch("https://back.ayrshare.com/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${AYRSHARE_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        return {
          platform: input.platform,
          status: "failed",
          error: data.message || `خطأ في إرسال الطلب لـ Ayrshare (HTTP ${response.status})`
        };
      }

      // Successful publishing response from Ayrshare
      // Data returns: { status: "success", id: "post_id", post: "text", url: "published_url", ... }
      return {
        platform: input.platform,
        status: "published",
        providerPostId: data.id || `ayr_${Date.now()}`,
        providerUrl: data.url || `https://app.ayrshare.com`
      };
    } catch (error) {
      return {
        platform: input.platform,
        status: "failed",
        error: error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء الاتصال بـ Ayrshare."
      };
    }
  }
}
