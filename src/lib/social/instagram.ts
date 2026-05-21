import type { PublishInput, PublishResult, SocialPublisher } from "./types";

type InstagramResponse = {
  id?: string;
  permalink?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";
const instagramBusinessAccountId =
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ??
  process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
const accessToken =
  process.env.INSTAGRAM_ACCESS_TOKEN ??
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN ??
  process.env.META_PAGE_ACCESS_TOKEN ??
  process.env.META_ACCESS_TOKEN;

export class InstagramPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    if (instagramBusinessAccountId || accessToken) {
      return publishToInstagram(input);
    }

    return {
      platform: "instagram",
      status: "published",
      providerPostId: `ig_${input.postId}`,
      providerUrl: `https://instagram.example/p/${input.postId}`,
    };
  }
}

async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  if (!instagramBusinessAccountId || !accessToken) {
    return {
      platform: "instagram",
      status: "failed",
      error: "Instagram publishing requires INSTAGRAM_BUSINESS_ACCOUNT_ID and an Instagram/Page access token.",
    };
  }

  if (!input.assetUrl) {
    return {
      platform: "instagram",
      status: "failed",
      error: "Instagram Graph API requires a public image or video URL for publishing.",
    };
  }

  const container = await createInstagramMediaContainer(input);

  if (container.status === "failed" || !container.providerPostId) {
    return container;
  }

  const publishParams = new URLSearchParams({
    creation_id: container.providerPostId,
    access_token: accessToken,
  });

  const publishResponse = await fetch(
    `https://graph.facebook.com/${graphVersion}/${instagramBusinessAccountId}/media_publish`,
    {
      method: "POST",
      body: publishParams,
    },
  );
  const publishPayload = (await publishResponse.json().catch(() => null)) as InstagramResponse | null;

  if (!publishResponse.ok || publishPayload?.error || !publishPayload?.id) {
    return {
      platform: "instagram",
      status: "failed",
      error: formatInstagramError(publishPayload, publishResponse.status),
    };
  }

  const permalink = await readInstagramPermalink(publishPayload.id);

  return {
    platform: "instagram",
    status: "published",
    providerPostId: publishPayload.id,
    providerUrl: permalink ?? `https://www.instagram.com/`,
  };
}

async function createInstagramMediaContainer(input: PublishInput): Promise<PublishResult> {
  const params = new URLSearchParams({
    caption: input.body,
    access_token: accessToken ?? "",
  });
  const mediaKind = input.mediaKind ?? "";
  const isVideo = ["video", "reel", "story_video"].includes(mediaKind);

  if (isVideo) {
    params.set("media_type", "REELS");
    params.set("video_url", input.assetUrl ?? "");
  } else {
    params.set("image_url", input.assetUrl ?? "");
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${instagramBusinessAccountId}/media`, {
    method: "POST",
    body: params,
  });
  const payload = (await response.json().catch(() => null)) as InstagramResponse | null;

  if (!response.ok || payload?.error || !payload?.id) {
    return {
      platform: "instagram",
      status: "failed",
      error: formatInstagramError(payload, response.status),
    };
  }

  return {
    platform: "instagram",
    status: "queued",
    providerPostId: payload.id,
  };
}

async function readInstagramPermalink(mediaId: string) {
  const params = new URLSearchParams({
    fields: "permalink",
    access_token: accessToken ?? "",
  });

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${mediaId}?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as InstagramResponse | null;

  return response.ok && payload?.permalink ? payload.permalink : null;
}

function formatInstagramError(payload: InstagramResponse | null, status: number) {
  const error = payload?.error;

  if (!error) {
    return `Instagram Graph API returned HTTP ${status}`;
  }

  return [
    error.message ?? "Instagram Graph API error",
    error.code ? `code ${error.code}` : null,
    error.error_subcode ? `subcode ${error.error_subcode}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
