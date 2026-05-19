import "server-only";

type ImageKitUploadResult = {
  url?: string;
  fileId?: string;
  name?: string;
  error?: {
    message?: string;
  };
};

const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

export function isImageKitConfigured() {
  return Boolean(urlEndpoint && publicKey && privateKey);
}

export function getImageKitStatus() {
  return {
    configured: isImageKitConfigured(),
    urlEndpoint,
  };
}

export async function uploadMarketingAssetToImageKit(file: File) {
  if (!isImageKitConfigured()) {
    throw new Error("ImageKit غير مضبوط. أضف مفاتيح ImageKit إلى .env.local.");
  }

  if (!file.size) {
    return undefined;
  }

  const formData = new FormData();
  formData.set("file", new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" }));
  formData.set("fileName", cleanFileName(file.name));
  formData.set("folder", "/rewaq/marketing");
  formData.set("useUniqueFileName", "true");

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as ImageKitUploadResult | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error?.message ?? `ImageKit upload failed with HTTP ${response.status}`);
  }

  return {
    url: payload.url,
    fileId: payload.fileId,
    name: payload.name,
  };
}

function cleanFileName(name: string) {
  const fallback = `marketing-${Date.now()}`;
  const cleaned = name
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || fallback;
}
