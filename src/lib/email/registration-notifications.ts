import "server-only";

const FALLBACK_ADMIN_EMAIL = "osama.alhallq.14@gmail.com";

type RegistrationNotificationInput = {
  ownerName: string;
  organizationName: string;
  email: string;
  phone?: string;
  businessType: string;
};

type ApprovalMagicLinkInput = {
  to: string;
  ownerName: string;
  organizationName: string;
  actionLink: string;
};

export function getRegistrationAdminEmail() {
  return process.env.ADMIN_REGISTRATION_EMAIL || FALLBACK_ADMIN_EMAIL;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
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
        ...(html ? { html } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`تعذر إرسال البريد: ${errorText || response.status}`);
    }

    return { sent: true, to };
  }

  console.info("Email notification", { to, subject, text });
  return { sent: false, to };
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

  return sendEmail({ to, subject, text });
}

export async function sendAccountApprovedMagicLink(input: ApprovalMagicLinkInput) {
  const subject = `تمت الموافقة على حسابك في رواق - ${input.organizationName}`;
  const text = [
    `أهلًا ${input.ownerName},`,
    "",
    "تمت الموافقة على حسابك في رواق.",
    "اضغط الرابط التالي للدخول مباشرة إلى لوحة التحكم بدون كتابة كلمة المرور:",
    input.actionLink,
    "",
    "إذا لم تطلب هذا الحساب، تجاهل هذه الرسالة.",
  ].join("\n");
  const ownerName = escapeHtml(input.ownerName);
  const organizationName = escapeHtml(input.organizationName);
  const actionLink = escapeHtml(input.actionLink);
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
      <h2>تمت الموافقة على حسابك في رواق</h2>
      <p>أهلًا ${ownerName}, حساب ${organizationName} جاهز الآن.</p>
      <p>
        <a href="${actionLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
          الدخول إلى لوحة التحكم
        </a>
      </p>
      <p style="font-size:13px;color:#64748b;">إذا لم يعمل الزر، انسخ الرابط التالي وافتحه في المتصفح:</p>
      <p style="direction:ltr;font-size:13px;word-break:break-all;color:#334155;">${actionLink}</p>
    </div>
  `;

  return sendEmail({ to: input.to, subject, text, html });
}
