import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, Heart, MessageCircle, Share2, MoreHorizontal, User, Compass, Bookmark, Volume2, Plus } from "lucide-react";

type PreviewData = {
  title: string;
  body: string;
  hashtags: string;
  platforms: string[];
  publishMode: string;
  scheduledDate: string;
  scheduledTime: string;
  mediaUrl: string;
  postType: string;
};

type PostPreviewProps = {
  data: PreviewData;
};

export function RawaqPostPreview({ data }: PostPreviewProps) {
  // Determine which preview platforms are available
  const availablePlatforms = data.platforms.length > 0 ? data.platforms : ["facebook"];
  const [activePlatform, setActivePlatform] = React.useState<string>("facebook");

  // Keep activePlatform within available selection if possible, otherwise reset
  React.useEffect(() => {
    if (data.platforms.length > 0 && !data.platforms.includes(activePlatform)) {
      setActivePlatform(data.platforms[0]);
    }
  }, [data.platforms, activePlatform]);

  const captionText = data.body || "اكتب الكابشن في المحرر لعرض المعاينة الحية...";
  const hashText = data.hashtags || "";
  const imageUrl = data.mediaUrl || "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80"; // standard delicious food photo as fallback

  const renderPlatformContent = () => {
    switch (activePlatform) {
      case "facebook":
        return (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden text-right" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white font-bold">
                  ر
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">مطعم رواق - Rawaq Restaurant</h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span>الآن</span> • 🌍
                  </p>
                </div>
              </div>
              <button className="text-slate-400">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            {/* Caption */}
            <div className="px-3 pb-3 text-sm text-slate-800 space-y-1">
              <p className="whitespace-pre-wrap leading-relaxed">{captionText}</p>
              <p className="text-blue-600 font-medium">{hashText}</p>
            </div>

            {/* Media */}
            <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden border-y">
              <img src={imageUrl} alt="FB Post Media" className="h-full w-full object-cover" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-around border-t py-2 px-1 text-slate-500 text-xs font-semibold">
              <button className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-50">
                <Heart className="h-4 w-4" /> <span>أعجبني</span>
              </button>
              <button className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-50">
                <MessageCircle className="h-4 w-4" /> <span>تعليق</span>
              </button>
              <button className="flex items-center gap-1.5 py-1 px-3 rounded hover:bg-slate-50">
                <Share2 className="h-4 w-4" /> <span>مشاركة</span>
              </button>
            </div>
          </div>
        );

      case "instagram":
        return (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden text-right" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 p-[1.5px]">
                  <div className="grid h-full w-full place-items-center rounded-full bg-white text-xs font-bold text-slate-800">
                    ر
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">rawaq.restaurant</h4>
                  <p className="text-[9px] text-slate-400">مطعم رواق — فرع الرمال</p>
                </div>
              </div>
              <button className="text-slate-400">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            {/* Media */}
            <div className="aspect-square w-full bg-slate-100 overflow-hidden">
              <img src={imageUrl} alt="IG Post Media" className="h-full w-full object-cover" />
            </div>

            {/* Action Icons */}
            <div className="flex items-center justify-between p-3 text-slate-700">
              <div className="flex items-center gap-4">
                <Heart className="h-5 w-5 hover:text-red-500 cursor-pointer" />
                <MessageCircle className="h-5 w-5" />
                <Share2 className="h-5 w-5" />
              </div>
              <Bookmark className="h-5 w-5" />
            </div>

            {/* Likes */}
            <div className="px-3 pb-1 text-xs font-bold text-slate-800">
              أعجب بقيمة ١٤٥ شخصاً
            </div>

            {/* Caption */}
            <div className="px-3 pb-3 text-xs leading-relaxed">
              <span className="font-bold ml-1.5 text-slate-800">rawaq.restaurant</span>
              <span className="text-slate-700 whitespace-pre-wrap">{captionText}</span>{" "}
              <span className="text-blue-800">{hashText}</span>
            </div>
          </div>
        );

      case "tiktok":
        return (
          <div className="relative aspect-[9/16] w-full rounded-2xl bg-black overflow-hidden shadow-lg select-none">
            {/* Background/Video Placeholder */}
            <img src={imageUrl} alt="TikTok Media" className="absolute inset-0 h-full w-full object-cover opacity-90 filter blur-[1px] brightness-75" />
            <img src={imageUrl} alt="TikTok Main" className="absolute inset-0 h-full w-full object-contain z-10" />

            {/* Top Navigation */}
            <div className="absolute top-4 inset-x-0 flex items-center justify-center gap-4 text-white text-xs font-bold z-20">
              <span className="opacity-65">متابعة</span>
              <span className="border-b-2 border-white pb-1">لك (For You)</span>
            </div>

            {/* Right side interactions */}
            <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-20 text-white">
              {/* Profile */}
              <div className="relative flex flex-col items-center">
                <div className="h-10 w-10 rounded-full border border-white bg-slate-800 flex items-center justify-center font-bold text-sm">
                  ر
                </div>
                <span className="absolute -bottom-1.5 bg-red-500 rounded-full text-[10px] px-1 font-bold">
                  +
                </span>
              </div>

              {/* Heart */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2 backdrop-blur-md">
                  <Heart className="h-6 w-6 fill-white" />
                </div>
                <span className="text-[10px] font-semibold">12.5K</span>
              </div>

              {/* Comments */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2 backdrop-blur-md">
                  <MessageCircle className="h-6 w-6 fill-white" />
                </div>
                <span className="text-[10px] font-semibold">248</span>
              </div>

              {/* Share */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2 backdrop-blur-md">
                  <Share2 className="h-6 w-6 fill-white" />
                </div>
                <span className="text-[10px] font-semibold">89</span>
              </div>
            </div>

            {/* Bottom Overlay Text */}
            <div className="absolute bottom-4 left-3 right-16 z-20 text-white text-right" dir="rtl">
              <h4 className="font-bold text-sm">@rawaq.restaurant</h4>
              <p className="mt-1.5 text-xs line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {captionText} {hashText}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] bg-white/10 w-fit px-2 py-1 rounded-full backdrop-blur-sm">
                <Volume2 className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">الصوت الأصلي - مطعم رواق</span>
              </div>
            </div>
          </div>
        );

      case "youtube_shorts":
        return (
          <div className="relative aspect-[9/16] w-full rounded-2xl bg-black overflow-hidden shadow-lg select-none">
            {/* Background Image */}
            <img src={imageUrl} alt="Shorts Media" className="absolute inset-0 h-full w-full object-cover opacity-90 filter blur-[1px] brightness-75" />
            <img src={imageUrl} alt="Shorts Main" className="absolute inset-0 h-full w-full object-contain z-10" />

            {/* Top Header */}
            <div className="absolute top-4 right-4 z-20 text-white font-bold text-sm flex items-center gap-2">
              <Compass className="h-5 w-5" />
              <span>Shorts</span>
            </div>

            {/* Right Side Buttons */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20 text-white">
              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2.5 backdrop-blur-md">
                  <Heart className="h-5.5 w-5.5 fill-white" />
                </div>
                <span className="text-[10px]">أعجبني</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2.5 backdrop-blur-md">
                  <MessageCircle className="h-5.5 w-5.5 fill-white" />
                </div>
                <span className="text-[10px]">تعليق</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <div className="rounded-full bg-black/35 p-2.5 backdrop-blur-md">
                  <Share2 className="h-5.5 w-5.5 fill-white" />
                </div>
                <span className="text-[10px]">مشاركة</span>
              </div>
            </div>

            {/* Bottom Details Overlay */}
            <div className="absolute bottom-4 left-3 right-16 z-20 text-white text-right" dir="rtl">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-xs">
                  ر
                </div>
                <div>
                  <h4 className="font-bold text-xs">رواق Shorts</h4>
                  <button className="bg-red-600 text-[9px] font-bold px-2 py-0.5 rounded-sm mt-0.5">
                    اشتراك
                  </button>
                </div>
              </div>
              <p className="mt-2.5 text-xs line-clamp-2 leading-relaxed whitespace-pre-wrap">
                {captionText} {hashText}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border-slate-100 shadow-sm overflow-hidden bg-slate-50/50">
      <CardHeader className="pb-3 border-b bg-white">
        <CardTitle className="flex items-center gap-2 text-md">
          <Eye className="h-4 w-4 text-primary" />
          معاينة حية للمنشور
        </CardTitle>
        <CardDescription>
          معاينة تفاعلية لشكل المنشور النهائي على الهواتف المحمولة.
        </CardDescription>

        {/* Platform Tabs */}
        <div className="flex flex-wrap gap-1.5 mt-3 border-t pt-3">
          {availablePlatforms.map((platform) => {
            const isActive = activePlatform === platform;
            let btnClass = "border-slate-200 text-slate-600 bg-white hover:bg-slate-50";

            if (isActive) {
              if (platform === "facebook") btnClass = "bg-blue-600 text-white border-blue-600";
              else if (platform === "instagram") btnClass = "bg-pink-600 text-white border-pink-600";
              else if (platform === "tiktok") btnClass = "bg-black text-white border-black";
              else if (platform === "youtube_shorts") btnClass = "bg-red-600 text-white border-red-600";
            }

            const labelMap: Record<string, string> = {
              facebook: "Facebook",
              instagram: "Instagram",
              tiktok: "TikTok",
              youtube_shorts: "YouTube Shorts"
            };

            return (
              <button
                key={platform}
                type="button"
                onClick={() => setActivePlatform(platform)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition shadow-sm ${btnClass}`}
              >
                {labelMap[platform] || platform}
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex items-center justify-center">
        <div className="w-full max-w-[320px] transition-all duration-300">
          {renderPlatformContent()}
          
          {data.publishMode === "schedule" && (
            <div className="mt-3 text-center rounded-lg border border-amber-250 bg-amber-50/50 p-2 text-xs text-amber-800">
              🕒 مجدول للنشر في: <b>{data.scheduledDate}</b> الساعة <b>{data.scheduledTime}</b>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
