import "server-only";

const FALLBACK_ADMIN_EMAIL = "osaco221@gmail.com";

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

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
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
  const adminUrl = `${getAppUrl()}/admin/users`;
  const subject = "طلب تفعيل حساب جديد";
  const text = [
    "يوجد مستخدم جديد طلب الوصول إلى الموقع.",
    "",
    `الاسم: ${input.ownerName}`,
    `البريد: ${input.email}`,
    `رقم الهاتف: ${input.phone || "غير مضاف"}`,
    `المؤسسة: ${input.organizationName}`,
    `نوع النشاط: ${input.businessType}`,
    `تاريخ التسجيل: ${new Date().toLocaleString("ar-PS")}`,
    "",
    "رابط لوحة التحكم للموافقة أو الرفض:",
    adminUrl,
  ].join("\n");
  const ownerName = escapeHtml(input.ownerName);
  const organizationName = escapeHtml(input.organizationName);
  const email = escapeHtml(input.email);
  const phone = escapeHtml(input.phone || "غير مضاف");
  const businessType = escapeHtml(input.businessType);
  const escapedAdminUrl = escapeHtml(adminUrl);
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
      <h2>طلب تفعيل حساب جديد</h2>
      <p>يوجد مستخدم جديد طلب الوصول إلى الموقع.</p>
      <p><strong>الاسم:</strong> ${ownerName}</p>
      <p><strong>البريد:</strong> ${email}</p>
      <p><strong>رقم الهاتف:</strong> ${phone}</p>
      <p><strong>المؤسسة:</strong> ${organizationName}</p>
      <p><strong>نوع النشاط:</strong> ${businessType}</p>
      <p><strong>تاريخ التسجيل:</strong> ${escapeHtml(new Date().toLocaleString("ar-PS"))}</p>
      <p>
        <a href="${escapedAdminUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
          فتح لوحة الموافقة
        </a>
      </p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
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
