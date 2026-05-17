import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="استعادة كلمة المرور"
      description="سنرسل رابط استعادة إذا كان البريد مسجلًا."
      footer={
        <Link href="/login" className="font-semibold text-primary">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      <ActionForm action={forgotPasswordAction} submitLabel="إرسال رابط الاستعادة" className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
