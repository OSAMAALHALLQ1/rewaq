/**
 * Social publishing types
 * Independent of domain types to avoid circular dependencies
 */

// Platform type (duplicated from domain to avoid circular import)
export type SocialPlatform = 
  | "facebook" 
  | "instagram" 
  | "telegram" 
  | "whatsapp" 
  | "tiktok" 
  | "x" 
  | "google_business" 
  | "linkedin" 
  | "youtube_shorts" 
  | "pinterest";

export type PublishInput = {
  organizationId: string;
  postId: string;
  platform: SocialPlatform;
  accountId: string;
  accountName: string;
  body: string;
  assetUrl?: string;
  mediaKind?: string;
  scheduleKind?: string;
  approvalRequired?: boolean;
  errorPolicy?: string;
};

export type PublishResult = {
  platform: SocialPlatform;
  status: "published" | "queued" | "failed";
  providerPostId?: string;
  providerUrl?: string;
  error?: string;
};

export interface SocialPublisher {
  publish(input: PublishInput): Promise<PublishResult>;
}
