import type { SocialPlatform } from "@/types/domain";

export type PublishInput = {
  organizationId: string;
  postId: string;
  platform: SocialPlatform;
  accountId: string;
  accountName: string;
  body: string;
  assetUrl?: string;
};

export type PublishResult = {
  platform: SocialPlatform;
  status: "published" | "failed";
  providerPostId?: string;
  providerUrl?: string;
  error?: string;
};

export interface SocialPublisher {
  publish(input: PublishInput): Promise<PublishResult>;
}
