import { Clock3, LogOut, MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth";

export default function PendingApprovalPage() {
  return (
    <AuthCard
      title="حسابك بانتظار موافقة الإدارة"
      description="تم إنشاء حسابك بنجاح. بعد موافقة الإدارة ستتمكن من الدخول إلى النظام."
      footer={
        <form action={logoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut className="h-4 w-4" />
            تسجيل خروج
          </Button>
        </form>
      }
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
          <Clock3 className="h-7 w-7" />
        </div>
        <div className="rounded-2xl border border-warning/25 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          حسابك بانتظار موافقة الإدارة. بعد الموافقة ستتمكن من الدخول إلى الموقع.
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-4 text-start text-sm leading-6 text-muted-foreground">
          <MailCheck className="mt-0.5 h-5 w-5 text-primary" />
          <p>تم إرسال إشعار إلى بريد الإدارة لمراجعة طلبك، وستصلك رسالة عند قبول الحساب.</p>
        </div>
      </div>
    </AuthCard>
  );
}
