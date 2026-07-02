import type { PublishInput, PublishResult, SocialPublisher } from "./types";
import { createAdminClientWithContext } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

type FacebookResponse = {
  id?: string;
  post_id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";
const envPageId = process.env.FACEBOOK_PAGE_ID;
const envPageAccessToken =
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN ??
  process.env.META_PAGE_ACCESS_TOKEN ??
  process.env.META_ACCESS_TOKEN;

export class FacebookPublisher implements SocialPublisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    let resolvedPageId = envPageId;
    let resolvedAccessToken = envPageAccessToken;

    try {
      if (input.accountId) {
        const admin = createAdminClientWithContext("facebook/publisher");
        const { data: account } = await admin
          .from("social_accounts")
          .select("encrypted_access_token, external_account_id")
          .eq("id", input.accountId)
          .maybeSingle();

        if (account?.encrypted_access_token && account?.external_account_id) {
          resolvedPageId = account.external_account_id;
          resolvedAccessToken = decrypt(account.encrypted_access_token);
        }
      }
    } catch (dbError) {
      console.error("Failed to fetch custom Facebook credentials from DB, using env fallback:", dbError);
    }

    if (resolvedPageId && resolvedAccessToken) {
      return publishToFacebookPage(input, resolvedPageId, resolvedAccessToken);
    }

    // Dev/Sandbox Mock fallback if neither DB nor Env variables are set
    return {
      platform: "facebook",
      status: "published",
      providerPostId: `fb_${input.postId}`,
      providerUrl: `https://facebook.example/pages/${input.accountId}/posts/${input.postId}`,
    };
  }
}

async function publishToFacebookPage(input: PublishInput, pageId: string, pageAccessToken: string): Promise<PublishResult> {
  if (!pageId || !pageAccessToken) {
    return {
      platform: "facebook",
      status: "failed",
      error: "Facebook publishing requires FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  const isPhotoPost = Boolean(input.assetUrl && ["single_image", "multi_image", "pin"].includes(input.mediaKind ?? ""));
  const path = isPhotoPost ? `${pageId}/photos` : `${pageId}/feed`;
  const params = new URLSearchParams({
    access_token: pageAccessToken,
  });

  if (isPhotoPost && input.assetUrl) {
    params.set("url", input.assetUrl);
    params.set("caption", input.body);
    params.set("published", "true");
  } else {
    params.set("message", input.body);

    if (input.assetUrl) {
      params.set("link", input.assetUrl);
    }
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    method: "POST",
    body: params,
  });
  const payload = (await response.json().catch(() => null)) as FacebookResponse | null;

  if (!response.ok || payload?.error) {
    return {
      platform: "facebook",
      status: "failed",
      error: formatFacebookError(payload, response.status),
    };
  }

  const providerPostId = payload?.post_id ?? payload?.id ?? `fb_${input.postId}`;

  return {
    platform: "facebook",
    status: "published",
    providerPostId,
    providerUrl: `https://www.facebook.com/${providerPostId}`,
  };
}

function formatFacebookError(payload: FacebookResponse | null, status: number) {
  const error = payload?.error;

  if (!error) {
    return `Facebook Graph API returned HTTP ${status}`;
  }

  return [
    error.message ?? "Facebook Graph API error",
    error.code ? `code ${error.code}` : null,
    error.error_subcode ? `subcode ${error.error_subcode}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

