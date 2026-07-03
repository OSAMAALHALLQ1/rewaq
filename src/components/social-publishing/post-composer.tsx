import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Sparkles, ImagePlus, Check, Save, Calendar, ClipboardCheck } from "lucide-react";


const AI_CAPTIONS_POOL = [
  "🔥 عرض اليوم المميز! استمتعوا بوجبتنا الأكثر طلبًا مع مشروب مجاني بسعر لا يقبل المنافسة لفترة محدودة. شاركونا زيارتكم اليوم! 🍔🍟",
  "😍 صنف جديد وصل لعائلة منيو مطعمنا! طبق معدّ بحب ومكونات طازجة 100%. جربوه اليوم في كل فروعنا وشاركونا تجربتكم! 🍕",
  "🎉 خصم نهاية الأسبوع بانتظاركم! احصل على خصم 15% على كامل المنيو عند الطلب داخل الصالة أو عبر التوصيل. أهلاً وسهلاً بكم! 🥩",
  "🌙 رمضان أحلى في مطعمنا! جربوا قائمة السحور والإفطار الرمضانية الغنية بأشهى الأطباق العربية والحلويات المميزة. حياكم الله! 🕌",
  "🥳 يسعدنا استعراض وجبتنا الأكثر طلبًا من عملائنا! طعم لا ينسى وتجربة فريدة بانتظاركم الآن. اطلبها الآن وشاركها مع أصدقائك! 🍗",
  "📢 بشرى سارة لأهلنا! تم افتتاح فرعنا الجديد رسمياً. زورونا واستمتعوا بعروض الافتتاح الخاصة والخصومات الحصرية طوال هذا الأسبوع! 📍"
];

const PLATFORMS_META = [
  { id: "facebook", name: "Facebook" },
  { id: "instagram", name: "Instagram" },
];

export type ComposerState = {
  title: string;
  body: string;
  hashtags: string;
  postType: string;
  platforms: string[];
  publishMode: "now" | "schedule" | "draft";
  scheduledDate: string;
  scheduledTime: string;
  mediaUrl: string;
  mediaFile: File | null;
};

type PostComposerProps = {
  connectedPlatforms: string[];
  onChange: (state: ComposerState) => void;
  onSubmit: (state: ComposerState) => void;
  onSaveDraft: (state: ComposerState) => void;
  onPrepare: (state: ComposerState) => void;
};

export function RawaqPostComposer({ connectedPlatforms: _connectedPlatforms, onChange, onSubmit, onSaveDraft, onPrepare }: PostComposerProps) {
  const [state, setState] = React.useState<ComposerState>({
    title: "",
    body: "",
    hashtags: "#مطعم_رواق #عروض #وجبات_شهية",
    postType: "general",
    platforms: ["facebook"],
    publishMode: "now",
    scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "12:00",
    mediaUrl: "",
    mediaFile: null
  });

  const [aiIndex, setAiIndex] = React.useState(0);

  // Notify parent of state changes
  React.useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  const updateState = (updates: Partial<ComposerState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleAiCaption = () => {
    const nextCaption = AI_CAPTIONS_POOL[aiIndex];
    setAiIndex((prev) => (prev + 1) % AI_CAPTIONS_POOL.length);
    updateState({ body: nextCaption });
  };

  const handlePlatformToggle = (platformId: string) => {
    updateState({
      platforms: state.platforms.includes(platformId)
        ? state.platforms.filter((p) => p !== platformId)
        : [...state.platforms, platformId]
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const url = URL.createObjectURL(file);
      updateState({ mediaUrl: url, mediaFile: file });
    }
  };

  const handleActionSubmit = (mode: "now" | "schedule" | "draft") => {
    const finalState = { ...state, publishMode: mode };
    updateState({ publishMode: mode });

    // Validate
    if (!finalState.title.trim()) {
      alert("يرجى إدخال عنوان المنشور داخلياً.");
      return;
    }
    if (!finalState.body.trim()) {
      alert("يرجى إدخال نص المنشور (الكابشن).");
      return;
    }
    if (finalState.platforms.length === 0) {
      alert("يرجى اختيار منصة نشر واحدة على الأقل.");
      return;
    }
    if (mode === "schedule") {
      if (!finalState.scheduledDate || !finalState.scheduledTime) {
        alert("يرجى تحديد التاريخ والوقت لجدولة النشر.");
        return;
      }
    }

    if (mode === "draft") {
      onSaveDraft(finalState);
    } else {
      onSubmit(finalState);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Post Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="title" className="text-slate-700">عنوان المنشور (داخلي)</Label>
          <Input
            id="title"
            placeholder="مثال: عرض وجبة التوفير اليومية"
            value={state.title}
            onChange={(e) => updateState({ title: e.target.value })}
            className="border-slate-200"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="post-type" className="text-slate-700">تصنيف المنشور / نوعه</Label>
          <Select
            id="post-type"
            value={state.postType}
            onChange={(e) => updateState({ postType: e.target.value })}
          >
            <option value="general">منشور عام</option>
            <option value="today_offer">عرض اليوم 🔥</option>
            <option value="new_dish">وجبة جديدة 🍽️</option>
            <option value="weekend_discount">خصم نهاية الأسبوع 🎁</option>
            <option value="ramadan_menu">منيو رمضان 🌙</option>
            <option value="branch_opening">افتتاح فرع جديد 📍</option>
            <option value="most_wanted">طبق الأكثر طلبًا ⭐</option>
          </Select>
        </div>
      </div>

      {/* Caption & Hashtags */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="body" className="text-slate-700">نص المنشور / الكابشن</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAiCaption}
            className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Sparkles className="h-3 w-3" />
            اقترح كابشن بالذكاء الاصطناعي
          </Button>
        </div>
        <Textarea
          id="body"
          rows={5}
          placeholder="اكتب تفاصيل العرض، الوجبة أو المنشور هنا..."
          value={state.body}
          onChange={(e) => updateState({ body: e.target.value })}
          className="border-slate-200"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="hashtags" className="text-slate-700">الهاشتاقات</Label>
        <Input
          id="hashtags"
          placeholder="مثال: #مطعم_رواق #عروض #زنجر"
          value={state.hashtags}
          onChange={(e) => updateState({ hashtags: e.target.value })}
          className="border-slate-200"
        />
      </div>

      {/* Media Upload */}
      <div className="grid gap-2">
        <Label className="text-slate-700">صورة الوجبة أو العرض</Label>
        <div className="relative grid gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100/50">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <ImagePlus className="h-5 w-5 text-primary shrink-0" />
            <span>اختر صورة جذابة للوجبة لزيادة التفاعل</span>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {state.mediaUrl && (
            <div className="relative mt-2 h-32 w-full overflow-hidden rounded-lg border bg-white">
              <img
                src={state.mediaUrl}
                alt="معاينة الوسائط"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => updateState({ mediaUrl: "", mediaFile: null })}
                className="absolute top-2 left-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
                style={{ direction: "ltr" }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Platform Selector */}
      <div className="grid gap-2">
        <Label className="text-slate-700">منصات التواصل الاجتماعي المستهدفة</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLATFORMS_META.map((p) => {
            const isConnected = true;
            const isSelected = state.platforms.includes(p.id);

            return (
              <button
                key={p.id}
                type="button"
                disabled={!isConnected}
                onClick={() => handlePlatformToggle(p.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-right text-sm transition ${
                  !isConnected
                    ? "opacity-50 bg-slate-50 cursor-not-allowed border-slate-100"
                    : isSelected
                    ? "border-primary bg-primary/5 font-semibold text-primary"
                    : "bg-white hover:border-slate-300 border-slate-200"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                    isSelected
                      ? "border-primary bg-primary text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {state.platforms.length > 1 ? "نشر مزدوج" : "جاهز عبر الوكيل المحلي"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scheduling / Publish options */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="publishMode"
              checked={state.publishMode === "now"}
              onChange={() => updateState({ publishMode: "now" })}
              className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
            />
            تجهيز للنشر الآن
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="publishMode"
              checked={state.publishMode === "schedule"}
              onChange={() => updateState({ publishMode: "schedule" })}
              className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
            />
            جدولة المنشور لوقت لاحق
          </label>
        </div>

        {state.publishMode === "schedule" && (
          <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-200">
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-date" className="text-xs text-slate-500">تاريخ النشر</Label>
              <div className="relative">
                <Input
                  id="schedule-date"
                  type="date"
                  value={state.scheduledDate}
                  onChange={(e) => updateState({ scheduledDate: e.target.value })}
                  className="border-slate-200 pl-9"
                />
                <Calendar className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-time" className="text-xs text-slate-500">وقت النشر</Label>
              <Input
                id="schedule-time"
                type="time"
                value={state.scheduledTime}
                onChange={(e) => updateState({ scheduledTime: e.target.value })}
                className="border-slate-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleActionSubmit("draft")}
          className="gap-1 text-slate-700 border-slate-200 hover:bg-slate-50"
        >
          <Save className="h-4 w-4" />
          حفظ كمسودة
        </Button>
        <Button
          type="button"
          onClick={() => {
            const mode: ComposerState["publishMode"] = state.publishMode === "now" ? "now" : "schedule";
            const finalState = { ...state, publishMode: mode };
            updateState({ publishMode: mode });

            if (!finalState.title.trim()) {
              alert("يرجى إدخال عنوان المنشور داخلياً.");
              return;
            }
            if (!finalState.body.trim()) {
              alert("يرجى إدخال نص المنشور (الكابشن).");
              return;
            }
            if (finalState.platforms.length === 0) {
              alert("يرجى اختيار Facebook أو Instagram على الأقل.");
              return;
            }

            onPrepare(finalState);
          }}
          className="gap-1 px-6"
        >
          <ClipboardCheck className="h-4 w-4" />
          {state.publishMode === "now" ? "جهز وانسخ للنشر" : "جهز للجدولة"}
        </Button>
      </div>

      {/* TODO Comments (Requirements compliance) */}
      {/* TODO: Add the Electron Rewaq Publisher auto-fill client. */}
      {/* TODO: Add TikTok publishing. */}
      {/* TODO: Add YouTube Shorts publishing. */}
      {/* TODO: Add analytics sync. */}
    </div>
  );
}
