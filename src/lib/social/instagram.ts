import type { PublishInput, PublishResult, SocialPublisher } from "./types";

export class InstagramPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (input.accountName.includes("thai.restaurant")) {
      return {
        platform: "instagram",
        status: "failed",
        error: "انتهت صلاحية الربط. أعد ربط حساب Instagram Business.",
      };
    }

    return {
      platform: "instagram",
      status: "published",
      providerPostId: `ig_${input.postId}`,
      providerUrl: `https://instagram.example/p/${input.postId}`,
    };
  }
}
