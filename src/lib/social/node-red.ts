import type { PublishInput, PublishResult, SocialPublisher } from "./types";

type NodeRedPublishResponse = {
  status?: "published" | "failed";
  providerPostId?: string;
  providerUrl?: string;
  error?: string;
  id?: string;
  url?: string;
};

const WEBHOOK_URL = process.env.NODE_RED_SOCIAL_PUBLISH_WEBHOOK_URL;
const API_KEY = process.env.NODE_RED_SOCIAL_PUBLISH_API_KEY ?? process.env.NODE_RED_API_KEY;

export function isNodeRedSocialPublishingConfigured() {
  return Boolean(WEBHOOK_URL);
}

export function getNodeRedSocialPublishingStatus() {
  return {
    configured: isNodeRedSocialPublishingConfigured(),
    webhookUrl: WEBHOOK_URL,
  };
}

export class NodeRedSocialPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (!WEBHOOK_URL) {
      return {
        platform: input.platform,
        status: "failed",
        error: "NODE_RED_SOCIAL_PUBLISH_WEBHOOK_URL غير مضبوط.",
      };
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        source: "rewaq",
        event: "social.publish",
        version: 1,
        organizationId: input.organizationId,
        postId: input.postId,
        platform: input.platform,
        accountId: input.accountId,
        accountName: input.accountName,
        body: input.body,
        assetUrl: input.assetUrl,
        mediaKind: input.mediaKind,
        scheduleKind: input.scheduleKind,
        approvalRequired: input.approvalRequired,
        errorPolicy: input.errorPolicy,
      }),
    });

    const payload = (await response.json().catch(() => null)) as NodeRedPublishResponse | null;

    if (!response.ok || payload?.status === "failed") {
      return {
        platform: input.platform,
        status: "failed",
        error: payload?.error ?? `Node-RED returned HTTP ${response.status}`,
      };
    }

    return {
      platform: input.platform,
      status: "published",
      providerPostId: payload?.providerPostId ?? payload?.id ?? `node_red_${input.platform}_${input.postId}`,
      providerUrl: payload?.providerUrl ?? payload?.url,
    };
  }
}
