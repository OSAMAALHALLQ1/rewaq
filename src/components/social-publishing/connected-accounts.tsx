import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Link2Off, Sparkles, Check, AlertCircle } from "lucide-react";

type Account = {
  id: string;
  platform: string;
  accountName: string;
  status: "connected" | "expired" | "disabled" | "local_agent";
};

type ConnectedAccountsProps = {
  accounts: Account[];
  onToggleAccount: (platform: string) => void;
};

export function RawaqConnectedAccounts({ accounts, onToggleAccount }: ConnectedAccountsProps) {
  const platforms = [
    {
      id: "facebook",
      name: "Facebook",
      description: "نشر المنشورات والصور الترويجية على صفحة المطعم",
      color: "border-blue-100 hover:border-blue-300",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      iconClass: "bg-blue-600 text-white",
      logo: "F",
      comingSoon: false,
    },
    {
      id: "instagram",
      name: "Instagram",
      description: "نشر صور وجبات المنيو اليومية والقصص التفاعلية",
      color: "border-pink-100 hover:border-pink-300",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      iconClass: "bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white",
      logo: "I",
      comingSoon: false,
    },
    {
      id: "tiktok",
      name: "TikTok",
      description: "نشر فيديوهات تحضير الطعام وخلف الكواليس لزيادة التفاعل",
      color: "border-slate-200 hover:border-slate-400",
      badgeColor: "bg-slate-900 text-white border-slate-950",
      iconClass: "bg-black text-white",
      logo: "T",
      comingSoon: false,
    },
    {
      id: "youtube_shorts",
      name: "YouTube Shorts",
      description: "مشاركة الفيديوهات القصيرة لعروض المطعم المميزة",
      color: "border-red-100 hover:border-red-300",
      badgeColor: "bg-red-50 text-red-700 border-red-200",
      iconClass: "bg-red-600 text-white",
      logo: "Y",
      comingSoon: false,
    },
  ];

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          الحسابات المتصلة وقنوات النشر
        </CardTitle>
        <CardDescription>
          فعّل الوكيل المحلي لتجهيز المنشورات داخل Meta Business Suite بدون صلاحيات Meta Review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((p) => {
            const connectedAccount = accounts.find((a) => a.platform === p.id && (a.status === "connected" || a.status === "local_agent"));
            const isConnected = !!connectedAccount;
            const isLocalAgent = connectedAccount?.status === "local_agent";

            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-xl border p-4 transition ${p.color} ${
                  isConnected ? "bg-slate-50/30" : "bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-extrabold ${p.iconClass}`}
                    >
                      {p.logo}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        isConnected
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isConnected ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> {isLocalAgent ? "وكيل محلي" : "متصل"}
                        </span>
                      ) : (
                        "غير متصل"
                      )}
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold text-slate-800">{p.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-5 min-h-[40px]">
                    {isConnected ? (
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        {isLocalAgent ? "التجهيز يتم عبر Rewaq Publisher" : `معرّف الحساب: ${connectedAccount.accountName}`}
                      </span>
                    ) : (
                      p.description
                    )}
                  </p>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {isConnected ? "جاهز للتجهيز والنسخ" : "فعّل القناة للبدء"}
                  </div>
                  <Button
                    type="button"
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    onClick={() => onToggleAccount(p.id)}
                    className="h-8 text-xs gap-1"
                  >
                    {isConnected ? (
                      <>
                        <Link2Off className="h-3 w-3" /> إلغاء الربط
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3 w-3" /> تفعيل الوكيل
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
