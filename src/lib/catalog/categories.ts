export const DEFAULT_ITEM_CATEGORIES = [
  "وجبات",
  "ساندويتشات",
  "برجر",
  "بيتزا",
  "مقبلات",
  "سلطات",
  "شوربات",
  "أطباق جانبية",
  "مشروبات باردة",
  "مشروبات ساخنة",
  "حلويات",
  "عروض",
  "وجبات عائلية",
  "دجاج",
  "لحوم",
  "أسماك",
  "خضار",
  "فواكه",
  "حبوب ونشويات",
  "أرز ومعكرونة",
  "زيوت",
  "أجبان وألبان",
  "صوصات",
  "بهارات",
  "مخبوزات",
  "تغليف",
  "مواد تنظيف",
  "مستهلكات تشغيل",
];

export function mergeCategoryNames(names: string[]) {
  return Array.from(new Set([...names.filter(Boolean), ...DEFAULT_ITEM_CATEGORIES])).sort((a, b) =>
    a.localeCompare(b, "ar"),
  );
}
