import type { SocialPlatform } from "@/types/domain";
import { DemoSocialPublisher } from "./demo";
import { FacebookPublisher } from "./facebook";
import { InstagramPublisher } from "./instagram";
import { isNodeRedSocialPublishingConfigured, NodeRedSocialPublisher } from "./node-red";
import { TelegramPublisher } from "./telegram";
import { isTriggerDevSocialPublishingConfigured, TriggerDevSocialPublisher } from "./trigger-dev";
import type { PublishInput, PublishResult, SocialPublisher } from "./types";
import { WhatsappPublisher } from "./whatsapp";

const publishers: Partial<Record<SocialPlatform, SocialPublisher>> = {
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  whatsapp: new WhatsappPublisher(),
  telegram: new TelegramPublisher(),
};

const nodeRedPublisher = new NodeRedSocialPublisher();
const triggerDevPublisher = new TriggerDevSocialPublisher();
const demoPublisher = new DemoSocialPublisher();

export async function publishSocialPost(inputs: PublishInput[]): Promise<PublishResult[]> {
  const jobs = inputs.map(async (input) => {
    const publisher = getPublisher(input.platform);

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

function getPublisher(platform: SocialPlatform) {
  if (isTriggerDevSocialPublishingConfigured()) {
    return triggerDevPublisher;
  }

  if (isNodeRedSocialPublishingConfigured()) {
    return nodeRedPublisher;
  }

  return publishers[platform] ?? demoPublisher;
}

export type { PublishInput, PublishResult, SocialPublisher };
