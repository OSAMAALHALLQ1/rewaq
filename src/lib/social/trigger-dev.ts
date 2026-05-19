import type { PublishInput, PublishResult, SocialPublisher } from "./types";

type TriggerDevResponse = {
  ok?: boolean;
  id?: string;
  runId?: string;
  url?: string;
  dashboardUrl?: string;
  error?: string;
};

const ENDPOINT = process.env.TRIGGER_DEV_SOCIAL_PUBLISH_ENDPOINT;
const API_KEY = process.env.TRIGGER_DEV_API_KEY;

export function isTriggerDevSocialPublishingConfigured() {
  return Boolean(ENDPOINT);
}

export function getTriggerDevSocialPublishingStatus() {
  return {
    configured: isTriggerDevSocialPublishingConfigured(),
    endpoint: ENDPOINT,
  };
}

export class TriggerDevSocialPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (!ENDPOINT) {
      return {
        platform: input.platform,
        status: "failed",
        error: "TRIGGER_DEV_SOCIAL_PUBLISH_ENDPOINT غير مضبوط.",
      };
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        task: "social.publish",
        source: "rewaq",
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

    const payload = (await response.json().catch(() => null)) as TriggerDevResponse | null;

    if (!response.ok || payload?.ok === false) {
      return {
        platform: input.platform,
        status: "failed",
        error: payload?.error ?? `Trigger.dev returned HTTP ${response.status}`,
      };
    }

    return {
      platform: input.platform,
      status: "queued",
      providerPostId: payload?.runId ?? payload?.id ?? `trigger_${input.platform}_${input.postId}`,
      providerUrl: payload?.dashboardUrl ?? payload?.url,
    };
  }
}
