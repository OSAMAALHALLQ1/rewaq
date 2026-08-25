import "server-only";

import nodemailer from "nodemailer";

export type EmailProvider = "smtp" | "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult =
  | { sent: true; provider: EmailProvider }
  | { sent: false; provider: null };

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

type ResendConfig = {
  apiKey: string;
  from: string;
};

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function readEmailProvider(): EmailProvider | null {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider) {
    if (isProduction()) {
      throw new EmailConfigurationError(
        "إعدادات البريد غير مكتملة: عيّن EMAIL_PROVIDER إلى smtp أو resend.",
      );
    }

    return null;
  }

  if (configuredProvider === "smtp" || configuredProvider === "resend") {
    return configuredProvider;
  }

  throw new EmailConfigurationError("EMAIL_PROVIDER يجب أن تكون smtp أو resend.");
}

function requiredValue(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function readSmtpConfig(): SmtpConfig {
  const host = requiredValue("SMTP_HOST");
  const portValue = requiredValue("SMTP_PORT");
  const secureValue = requiredValue("SMTP_SECURE");
  const user = requiredValue("SMTP_USER");
  const password = requiredValue("SMTP_PASSWORD");
  const from = requiredValue("EMAIL_FROM");
  const missing = [
    !host && "SMTP_HOST",
    !portValue && "SMTP_PORT",
    !secureValue && "SMTP_SECURE",
    !user && "SMTP_USER",
    !password && "SMTP_PASSWORD",
    !from && "EMAIL_FROM",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new EmailConfigurationError(`إعدادات SMTP غير مكتملة: ${missing.join("، ")}.`);
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError("SMTP_PORT يجب أن يكون رقمًا صحيحًا بين 1 و65535.");
  }

  if (secureValue !== "true" && secureValue !== "false") {
    throw new EmailConfigurationError("SMTP_SECURE يجب أن تكون true أو false.");
  }

  return {
    host: host!,
    port,
    secure: secureValue === "true",
    user: user!,
    password: password!,
    from: from!,
  };
}

function readResendConfig(): ResendConfig {
  const apiKey = requiredValue("RESEND_API_KEY");
  const from = requiredValue("EMAIL_FROM");
  const missing = [!apiKey && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean);

  if (missing.length > 0) {
    throw new EmailConfigurationError(`إعدادات Resend غير مكتملة: ${missing.join("، ")}.`);
  }

  return { apiKey: apiKey!, from: from! };
}

/**
 * Validates the selected provider without sending a message. Use before a
 * state-changing operation whose completion depends on delivering an email.
 */
export function assertEmailProviderConfigured() {
  const provider = readEmailProvider();

  if (provider === "smtp") {
    readSmtpConfig();
  }

  if (provider === "resend") {
    readResendConfig();
  }
}

export function getSafeEmailErrorMessage(error: unknown) {
  if (error instanceof EmailConfigurationError || error instanceof EmailDeliveryError) {
    return error.message;
  }

  return "تعذر إرسال البريد. تحقق من إعدادات مزود البريد ثم أعد المحاولة.";
}

async function sendWithSmtp(input: SendEmailInput) {
  const config = readSmtpConfig();

  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    await transport.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
  } catch {
    // Do not include transport errors: they can echo SMTP credentials or email content.
    throw new EmailDeliveryError("تعذر إرسال البريد عبر SMTP. تحقق من إعداداته ثم أعد المحاولة.");
  }
}

async function sendWithResend(input: SendEmailInput) {
  const config = readResendConfig();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    if (!response.ok) {
      throw new EmailDeliveryError("تعذر إرسال البريد عبر Resend. تحقق من إعداداته ثم أعد المحاولة.");
    }
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      throw error;
    }

    // Network errors must not be relayed because providers may include request details.
    throw new EmailDeliveryError("تعذر إرسال البريد عبر Resend. تحقق من إعداداته ثم أعد المحاولة.");
  }
}

/**
 * Sends a server-only email through the explicitly selected provider. It never
 * logs message bodies, magic links, or provider credentials.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
  const provider = readEmailProvider();

  if (!provider) {
    return { sent: false, provider: null };
  }

  if (provider === "smtp") {
    await sendWithSmtp(input);
  } else {
    await sendWithResend(input);
  }

  return { sent: true, provider };
}
