import "server-only";

const FALLBACK_ADMIN_EMAIL = "osama.alhallq.14@gmail.com";

type RegistrationNotificationInput = {
  ownerName: string;
  organizationName: string;
  email: string;
  phone?: string;
  businessType: string;
};

export function getRegistrationAdminEmail() {
  return process.env.ADMIN_REGISTRATION_EMAIL || FALLBACK_ADMIN_EMAIL;
}

export async function sendRegistrationRequestNotification(input: RegistrationNotificationInput) {
  const to = getRegistrationAdminEmail();
  const subject = `طلب حساب جديد في رواق - ${input.organizationName}`;
  const text = [
    "وصل طلب حساب جديد يحتاج مراجعة.",
    "",
    `الاسم: ${input.ownerName}`,
    `المؤسسة: ${input.organizationName}`,
    `البريد: ${input.email}`,
    `الهاتف: ${input.phone || "غير مضاف"}`,
    `نوع النشاط: ${input.businessType}`,
    "",
    "افتح لوحة الأدمن ثم صفحة طلبات التسجيل للموافقة أو الرفض.",
  ].join("\n");

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`تعذر إرسال بريد إشعار التسجيل: ${errorText || response.status}`);
    }

    return { sent: true, to };
  }

  console.info("Registration approval email notification", { to, subject, text });
  return { sent: false, to };
}

export async function sendRegistrationApprovedNotification(input: {
  email: string;
  ownerName: string;
  organizationName: string;
}) {
  const to = input.email;
  const subject = `تم اعتماد حسابك في رواق - ${input.organizationName}`;
  const text = [
    `مرحبًا ${input.ownerName},`,
    "",
    `تمت الموافقة على طلب إنشاء حساب مؤسستك (${input.organizationName}). يمكنك الآن تسجيل الدخول إلى لوحة التحكم.`,
    "",
    `رابط تسجيل الدخول: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
  ].join("\n");

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`تعذر إرسال بريد اعتماد التسجيل: ${errorText || response.status}`);
    }

    return { sent: true, to };
  }

  console.info("Registration approved email (mock)", { to, subject, text });
  return { sent: false, to };
}
