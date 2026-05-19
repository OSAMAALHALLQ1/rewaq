import type { PublishInput, PublishResult, SocialPublisher } from "./types";

export class DemoSocialPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      platform: input.platform,
      status: "published",
      providerPostId: `demo_${input.platform}_${input.postId}`,
      providerUrl: `https://rewaq.local/social/${input.platform}/${input.postId}`,
    };
  }
}
