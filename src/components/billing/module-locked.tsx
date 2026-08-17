import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ModuleLocked({
  moduleLabel,
  currentPlanName,
  requiredPlanName,
  verificationFailed = false,
  canManageBilling = false,
  returnHref = "/dashboard",
}: {
  moduleLabel: string;
  currentPlanName: string;
  requiredPlanName: string;
  verificationFailed?: boolean;
  canManageBilling?: boolean;
  returnHref?: string | null;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-lg border-border/80 text-center">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-extrabold text-foreground">
            {verificationFailed
              ? "تعذر التحقق من صلاحية الباقة"
              : `وحدة ${moduleLabel} غير متاحة في باقتك الحالية`}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            {verificationFailed ? (
              <>
                أوقف رواق فتح وحدة {moduleLabel} مؤقتًا لأن حالة الاشتراك {currentPlanName}. لم
                تُنفذ أي عملية. أعد المحاولة أو راجع صفحة الفوترة.
              </>
            ) : (
              <>
                باقتك الحالية هي «{currentPlanName}». للوصول إلى وحدة {moduleLabel} تحتاج إلى
                باقة «{requiredPlanName}» أو أعلى. {canManageBilling
                  ? "يمكنك مراجعة الباقات وطلب الترقية من صفحة الفوترة."
                  : "تواصل مع مالك المؤسسة لطلب ترقية الباقة."}
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {canManageBilling ? (
              <Button asChild>
                <Link href="/dashboard/billing">مراجعة الباقات والترقية</Link>
              </Button>
            ) : null}
            {returnHref ? (
              <Button variant="outline" asChild>
                <Link href={returnHref}>العودة لمساحة العمل</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
