import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/server/actions/auth";

export default function RegisterPage() {
  return (
    <AuthCard
      title="إنشاء حساب رواق"
      description="أنشئ المؤسسة الأولى، ثم أضف الفروع والمستخدمين."
      footer={
        <>
          لديك حساب؟{" "}
          <Link href="/login" className="font-semibold text-primary">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <ActionForm action={registerAction} submitLabel="إنشاء الحساب" className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" name="name" placeholder="مالك المطعم" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="organizationName">اسم المؤسسة</Label>
          <Input id="organizationName" name="organizationName" defaultValue="مطعم التايلندي" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
