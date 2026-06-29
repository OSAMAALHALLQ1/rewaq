import { ImagePlus, Send, Share2, Sparkles } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_PLATFORM_IDS, socialPlatformMeta } from "@/lib/social/platforms";
import { createSocialPostAction } from "@/server/actions/social";
import { getMarketingData } from "@/server/queries/app";

export default async function QuickPublishPage() {
  const { accounts } = await getMarketingData();
  const connectedPlatforms = new Set(
    accounts.filter((account: any) => account.status === "connected").map((account: any) => account.platform),
  );
  const connectedCount = [...connectedPlatforms].length;

  return (
    <>
      <PageHeader
        title="نشر سريع لكل المنصات"
        description="اكتب منشوراً واحداً وانشره فوراً على كل حساباتك المتصلة دفعة واحدة — بلا خطوات معقدة."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              منشور اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createSocialPostAction} submitLabel="انشر للكل الآن" className="space-y-4">
              {/* Hidden defaults that map the simplified form onto the existing action. */}
              <input type="hidden" name="title" value="منشور سريع" />
              <input type="hidden" name="publishMode" value="now" />
              <input type="hidden" name="accountMode" value="default" />
              <input type="hidden" name="mediaKind" value="single_image" />
              {/* Select every connected platform automatically. */}
              {SOCIAL_PLATFORM_IDS.filter((p) => connectedPlatforms.has(p)).map((platform) => (
                <input key={platform} type="hidden" name="platforms" value={platform} />
              ))}

              <div className="grid gap-2">
                <Label htmlFor="body">نص المنشور *</Label>
                <Textarea
                  id="body"
                  name="body"
                  required
                  rows={5}
                  placeholder="اكتب عرض اليوم أو طبقاً جديداً... مثال: جربوا وجبة دجاج تايلندي اليوم بسعر مميز!"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="asset">صورة (اختياري)</Label>
                <div className="grid gap-2 rounded-lg border border-dashed bg-slate-50 p-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ImagePlus className="h-5 w-5 text-primary" />
                    ارفع صورة واحدة — تُنشر على كل المنصات المتصلة.
                  </div>
                  <Input name="asset" type="file" accept="image/*" />
                </div>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-accent" />
                المنصات المتصلة ({connectedCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {connectedCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد حسابات متصلة. اربط حساباتك من صفحة الحسابات أولاً.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORM_IDS.filter((p) => connectedPlatforms.has(p)).map((platform) => {
                    const meta = socialPlatformMeta[platform];
                    return (
                      <Badge key={platform} tone="success" className="gap-1">
                        <span className="text-xs font-bold">{meta.shortLabel}</span>
                        {meta.label}
                      </Badge>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-2 border-t border-slate-100 mt-3">
                عند الضغط على «انشر للكل» يُرسل نفس المنشور لكل منصة متصلة فوراً.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                نصيحة
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              <p>للنشر المتقدّم (جدولة، تكرار، تخصيص لكل منصة) استخدم صفحة «إنشاء منشور» الكاملة.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
