import type { SocialPlatform } from "@/types/domain";
import { FacebookPublisher } from "./facebook";
import { InstagramPublisher } from "./instagram";
import { TelegramPublisher } from "./telegram";
import type { PublishInput, PublishResult, SocialPublisher } from "./types";

const publishers: Partial<Record<SocialPlatform, SocialPublisher>> = {
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  telegram: new TelegramPublisher(),
};

export async function publishSocialPost(inputs: PublishInput[]): Promise<PublishResult[]> {
  const jobs = inputs.map(async (input) => {
    const publisher = publishers[input.platform];

    if (!publisher) {
      return {
        platform: input.platform,
        status: "failed" as const,
        error: "هذه المنصة غير مدعومة في MVP.",
      };
    }

    try {
      return await publisher.publish(input);
    } catch (error) {
      return {
        platform: input.platform,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "تعذر النشر",
      };
    }
  });

  return Promise.all(jobs);
}

export type { PublishInput, PublishResult, SocialPublisher };
