import type { SocialPlatform } from "@/types/domain";

export const SOCIAL_PLATFORM_IDS = [
  "facebook",
  "instagram",
  "telegram",
  "tiktok",
  "x",
  "google_business",
  "linkedin",
  "youtube_shorts",
  "pinterest",
] as const satisfies readonly SocialPlatform[];

export type SupportedSocialPlatform = (typeof SOCIAL_PLATFORM_IDS)[number];

export const socialPlatformMeta: Record<
  SupportedSocialPlatform,
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  facebook: {
    label: "فيسبوك",
    shortLabel: "FB",
    description: "صفحات المطعم والعروض اليومية",
  },
  instagram: {
    label: "إنستغرام",
    shortLabel: "IG",
    description: "صور الأطباق والقصص والحملات",
  },
  telegram: {
    label: "تلغرام",
    shortLabel: "TG",
    description: "قناة العروض والتنبيهات السريعة",
  },
  tiktok: {
    label: "تيك توك",
    shortLabel: "TT",
    description: "فيديوهات قصيرة للعروض والأطباق",
  },
  x: {
    label: "X",
    shortLabel: "X",
    description: "تحديثات قصيرة وروابط مباشرة",
  },
  google_business: {
    label: "Google Business",
    shortLabel: "GB",
    description: "منشورات تظهر في ملف المطعم على جوجل",
  },
  linkedin: {
    label: "LinkedIn",
    shortLabel: "IN",
    description: "نسخة مهنية للشراكات والعروض المؤسسية",
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    shortLabel: "YS",
    description: "وصف فيديو قصير أو حملة فيديو",
  },
  pinterest: {
    label: "Pinterest",
    shortLabel: "PI",
    description: "صور وقوائم وأفكار موسمية",
  },
};

export function getSocialPlatformLabel(platform: SocialPlatform) {
  return socialPlatformMeta[platform]?.label ?? platform;
}
