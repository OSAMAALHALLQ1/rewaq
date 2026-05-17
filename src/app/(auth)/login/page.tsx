import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/actions/auth";

export default function LoginPage() {
  return (
    <AuthCard
      title="تسجيل الدخول"
      description="ادخل إلى لوحة رواق لإدارة عمليات مطعمك."
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
        <div className="grid gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" name="email" type="email" defaultValue="owner@rewaq.app" required />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">كلمة المرور</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary">
              نسيت كلمة المرور؟
            </Link>
          </div>
          <Input id="password" name="password" type="password" defaultValue="password123" required />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
