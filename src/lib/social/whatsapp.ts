import type { PublishInput, PublishResult, SocialPublisher } from "./types";

type WhatsappCloudResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type ChannelWebhookResponse = {
  id?: string;
  messageId?: string;
  url?: string;
  providerUrl?: string;
  error?: string;
  message?: string;
};

const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken =
  process.env.WHATSAPP_ACCESS_TOKEN ??
  process.env.META_ACCESS_TOKEN;
const defaultRecipients = (process.env.WHATSAPP_DEFAULT_RECIPIENTS ?? "")
  .split(",")
  .map((recipient) => recipient.trim())
  .filter(Boolean);
const channelWebhookUrl = process.env.WHATSAPP_CHANNEL_WEBHOOK_URL;
const channelWebhookToken = process.env.WHATSAPP_CHANNEL_WEBHOOK_TOKEN;

export class WhatsappPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (channelWebhookUrl) {
      return publishToWhatsappChannelWebhook(input);
    }

    if (phoneNumberId || accessToken || defaultRecipients.length > 0) {
      return publishToWhatsappBusiness(input);
    }

    return {
      platform: "whatsapp",
      status: "published",
      providerPostId: `wa_${input.postId}`,
      providerUrl: `https://wa.me/`,
    };
  }
}

async function publishToWhatsappBusiness(input: PublishInput): Promise<PublishResult> {
  if (!phoneNumberId || !accessToken) {
    return {
      platform: "whatsapp",
      status: "failed",
      error: "WhatsApp Business publishing requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.",
    };
  }

  const recipients = resolveRecipients(input);

  if (recipients.length === 0) {
    return {
      platform: "whatsapp",
      status: "failed",
      error: "WhatsApp Business publishing requires WHATSAPP_DEFAULT_RECIPIENTS or a phone number as the account name.",
    };
  }

  const results = await Promise.all(recipients.map((recipient) => sendWhatsappTextMessage(recipient, input)));
  const failed = results.find((result) => result.status === "failed");

  if (failed) {
    return failed;
  }

  return {
    platform: "whatsapp",
    status: "published",
    providerPostId: results.map((result) => result.providerPostId).filter(Boolean).join(","),
    providerUrl: `https://wa.me/${recipients[0]}`,
  };
}

async function sendWhatsappTextMessage(recipient: string, input: PublishInput): Promise<PublishResult> {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: {
      preview_url: Boolean(input.assetUrl),
      body: input.assetUrl ? `${input.body}\n${input.assetUrl}` : input.body,
    },
  };

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as WhatsappCloudResponse | null;

  if (!response.ok || payload?.error) {
    return {
      platform: "whatsapp",
      status: "failed",
      error: formatWhatsappError(payload, response.status),
    };
  }

  return {
    platform: "whatsapp",
    status: "published",
    providerPostId: payload?.messages?.[0]?.id ?? `wa_${input.postId}_${recipient}`,
    providerUrl: `https://wa.me/${recipient}`,
  };
}

async function publishToWhatsappChannelWebhook(input: PublishInput): Promise<PublishResult> {
  if (!channelWebhookUrl) {
    return {
      platform: "whatsapp",
      status: "failed",
      error: "WhatsApp Channel publishing requires WHATSAPP_CHANNEL_WEBHOOK_URL.",
    };
  }

  const response = await fetch(channelWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(channelWebhookToken ? { Authorization: `Bearer ${channelWebhookToken}` } : {}),
    },
    body: JSON.stringify({
      platform: "whatsapp",
      channel: input.accountName,
      accountId: input.accountId,
      postId: input.postId,
      body: input.body,
      assetUrl: input.assetUrl,
      mediaKind: input.mediaKind,
    }),
  });
  const payload = (await response.json().catch(() => null)) as ChannelWebhookResponse | null;

  if (!response.ok || payload?.error) {
    return {
      platform: "whatsapp",
      status: "failed",
      error: payload?.error ?? payload?.message ?? `WhatsApp channel webhook returned HTTP ${response.status}`,
    };
  }

  return {
    platform: "whatsapp",
    status: "published",
    providerPostId: payload?.id ?? payload?.messageId ?? `wa_channel_${input.postId}`,
    providerUrl: payload?.providerUrl ?? payload?.url,
  };
}

function resolveRecipients(input: PublishInput) {
  const fromAccountName = input.accountName
    .split(",")
    .map((recipient) => recipient.replace(/[^\d+]/g, ""))
    .filter((recipient) => recipient.length >= 8);

  return fromAccountName.length > 0 ? fromAccountName : defaultRecipients;
}

function formatWhatsappError(payload: WhatsappCloudResponse | null, status: number) {
  const error = payload?.error;

  if (!error) {
    return `WhatsApp Cloud API returned HTTP ${status}`;
  }

  return [
    error.message ?? "WhatsApp Cloud API error",
    error.code ? `code ${error.code}` : null,
    error.error_subcode ? `subcode ${error.error_subcode}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
