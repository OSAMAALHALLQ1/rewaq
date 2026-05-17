import type { PublishInput, PublishResult, SocialPublisher } from "./types";

export class FacebookPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      platform: "facebook",
      status: "published",
      providerPostId: `fb_${input.postId}`,
      providerUrl: `https://facebook.example/pages/${input.accountId}/posts/${input.postId}`,
    };
  }
}
