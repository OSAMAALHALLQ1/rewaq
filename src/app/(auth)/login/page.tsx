import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DemoLoginButton } from "@/components/auth/demo-login-button";
import { loginAction } from "@/server/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ approval?: string }>;
}) {
  const { approval } = await searchParams;

  return (
    <AuthCard
      title="تسجيل الدخول"
      description="الدخول متاح بعد تفعيل البريد واعتماد الحساب. كل لوحة تحكم مرتبطة بحساب وصلاحية."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-semibold text-primary">
            إنشاء حساب
          </Link>
        </>
      }
    >
      <ActionForm action={loginAction} submitLabel="دخول" className="space-y-4">
        {approval === "pending" ? (
          <div className="rounded-2xl border border-warning/25 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            حسابك مسجل، لكنه بانتظار موافقة الإدارة قبل فتح لوحة التحكم.
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="email">البريد الإلكتروني / اسم المستخدم</Label>
          <Input id="email" name="email" type="text" placeholder="owner@example.com" required />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">كلمة المرور</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary">
              نسيت كلمة المرور؟
            </Link>
          </div>
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="rounded-2xl border border-border bg-muted p-3 text-sm leading-6 text-muted-foreground">
          صاحب الحساب يستطيع بعد الدخول دعوة الكاشير وأمين المخزن بالإيميل وكود دعوة، وكل شخص يدخل بلوحته وصلاحيته.
        </div>
      </ActionForm>

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
