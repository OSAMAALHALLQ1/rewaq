# Rewaq Publisher Agent

This replaces Meta Graph API publishing with a semi-automated local publishing flow.

## Dashboard Flow

1. The user creates a post in `/dashboard/social-publishing`.
2. The user clicks `جهز وانسخ للنشر`.
3. Rewaq saves the post as `ready`, copies the caption, downloads the selected image in the browser, and opens Meta Business Suite.
4. The user reviews the post in Meta and clicks Publish manually.
5. The user clicks `تم النشر` in Rewaq, or the local desktop agent calls the PATCH endpoint.

## Local Agent API

Set this variable in Vercel and in the desktop agent:

```text
REWAQ_PUBLISHER_AGENT_TOKEN=use-a-long-random-token
```

Fetch the latest ready post:

```http
GET /api/local-publisher/posts
Authorization: Bearer <REWAQ_PUBLISHER_AGENT_TOKEN>
```

Optional organization filter:

```http
GET /api/local-publisher/posts?organizationId=<uuid>
Authorization: Bearer <REWAQ_PUBLISHER_AGENT_TOKEN>
```

Mark a post as prepared, published, or failed:

```http
PATCH /api/local-publisher/posts
Authorization: Bearer <REWAQ_PUBLISHER_AGENT_TOKEN>
Content-Type: application/json

{
  "postId": "<uuid>",
  "status": "prepared",
  "metaPostUrl": "https://business.facebook.com/..."
}
```

Allowed status values:

```text
ready
prepared
published
failed
```

## Desktop App Notes

The Electron app should:

- Keep a fixed Chrome profile for Meta Business Suite login.
- Poll this API first; WebSocket/SSE can be added later if the deployment target supports persistent connections.
- Copy `caption`, download `imageUrl` to a local `Downloads/Rewaq` folder, and open `metaBusinessSuiteUrl`.
- Try Playwright auto-fill only as a convenience; final Publish remains manual.
