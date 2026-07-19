import Link from "next/link";
import { KeyRound, UserRound } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth/auth-card";
import { DemoLoginButton } from "@/components/auth/demo-login-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  employeeCodeLoginAction,
  ownerPasswordLoginAction,
} from "@/server/actions/access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ trial?: string }>;
}) {
  const { trial } = await searchParams;

  return (
    <AuthCard
      title="تسجيل الدخول"
      description="لا حاجة لإدخال البريد الإلكتروني: المالك يدخل بكلمة المرور، والموظف بكوده فقط."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-semibold text-primary">
            إنشاء حساب
          </Link>
        </>
      }
    >
      {trial === "expired" ? (
        <div className="mb-4 rounded-2xl border border-warning/25 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          انتهت الجلسة التجريبية المجانية (8 ساعات). يمكنك بدء تجربة جديدة أو إنشاء حساب للاستمرار.
        </div>
      ) : null}
      <Tabs defaultValue="owner">
        <TabsList className="w-full">
          <TabsTrigger value="owner" className="flex-1">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            دخول المالك
          </TabsTrigger>
          <TabsTrigger value="employee" className="flex-1">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            دخول الموظف
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owner">
          <ActionForm action={ownerPasswordLoginAction} submitLabel="دخول المالك" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="owner-password">كلمة مرور المالك</Label>
              <Input
                id="owner-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <p className="rounded-2xl border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
              حساب المالك محدد مسبقًا على الخادم، لذلك تكفي كلمة المرور وحدها للدخول.
            </p>
          </ActionForm>
        </TabsContent>

        <TabsContent value="employee">
          <ActionForm action={employeeCodeLoginAction} submitLabel="دخول الموظف" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="employee-code">كود الموظف</Label>
              <Input
                id="employee-code"
                name="inviteCode"
                type="text"
                autoComplete="off"
                placeholder="مثال: AB12CD34"
                required
              />
            </div>
            <p className="rounded-2xl border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
              لا كلمة مرور للموظف: الكود وحده يكفي للدخول، وإلغاء الكود من لوحة المالك يوقف الدخول فورًا.
            </p>
          </ActionForm>
        </TabsContent>
      </Tabs>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 font-bold text-muted-foreground">أو تجربة سريعة للنظام</span>
        </div>
      </div>

      <DemoLoginButton />
    </AuthCard>
  );
}
