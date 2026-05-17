import type { PublishInput, PublishResult, SocialPublisher } from "./types";

export class TelegramPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    return {
      platform: "telegram",
      status: "published",
      providerPostId: `tg_${input.postId}`,
      providerUrl: `https://telegram.example/${input.accountId}/${input.postId}`,
    };
  }
}
