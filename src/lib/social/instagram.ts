import type { PublishInput, PublishResult, SocialPublisher } from "./types";

export class InstagramPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      platform: "instagram",
      status: "published",
      providerPostId: `ig_${input.postId}`,
      providerUrl: `https://instagram.example/p/${input.postId}`,
    };
  }
}
