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
      description="سجل بالبريد الإلكتروني، فعّل بريدك، وبعد الموافقة يتم فتح حساب المؤسسة."
      footer={
        <>
          لديك حساب؟{" "}
          <Link href="/login" className="font-semibold text-primary">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <ActionForm action={registerAction} submitLabel="إرسال طلب الحساب" className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" name="name" placeholder="مالك النشاط" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="organizationName">اسم المؤسسة</Label>
          <Input id="organizationName" name="organizationName" defaultValue="مطعم إيوان" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="businessType">نوع النشاط</Label>
          <select id="businessType" name="businessType" className="h-11 rounded-lg border bg-white px-3 text-sm" required>
            <option value="restaurant">مطعم</option>
            <option value="cafe">كافيه</option>
            <option value="retail">متجر</option>
            <option value="multi_branch">عدة فروع</option>
            <option value="other">نشاط آخر</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">رقم التواصل</Label>
          <Input id="phone" name="phone" placeholder="059xxxxxxx" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="rounded-lg border bg-teal-50 p-3 text-sm leading-6 text-primary">
          بعد التسجيل: تصلك رسالة تفعيل على البريد، ثم تتم مراجعة الطلب والموافقة عليه قبل الدخول للداشبورد.
        </div>
      </ActionForm>
    </AuthCard>
  );
}
