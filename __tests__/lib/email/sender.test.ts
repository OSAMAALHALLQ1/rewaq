import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
const originalEnv = { ...process.env };

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

function setSmtpEnvironment() {
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASSWORD = `smtp-redaction-sentinel-${randomUUID()}`;
  process.env.EMAIL_FROM = "Rewaq <mailer@example.com>";
}

describe("server email sender", () => {
  beforeEach(() => {
    vi.resetModules();
    createTransport.mockClear();
    sendMail.mockReset();
    process.env = { ...originalEnv, NODE_ENV: "test" };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sends email through the configured SMTP transport", async () => {
    setSmtpEnvironment();
    sendMail.mockResolvedValue({ messageId: "smtp-message-id" });

    const { sendEmail } = await import("@/lib/email/sender");
    const result = await sendEmail({
      to: "owner@example.com",
      subject: "إشعار آمن",
      text: "محتوى الرسالة",
      html: "<p>محتوى الرسالة</p>",
    });

    expect(result).toEqual({ sent: true, provider: "smtp" });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "mailer@example.com", pass: process.env.SMTP_PASSWORD },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Rewaq <mailer@example.com>",
      to: "owner@example.com",
      subject: "إشعار آمن",
      text: "محتوى الرسالة",
      html: "<p>محتوى الرسالة</p>",
    });
  });

  it("fails clearly in production when SMTP settings are incomplete", async () => {
    setSmtpEnvironment();
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.SMTP_PASSWORD;

    const { sendEmail, EmailConfigurationError } = await import("@/lib/email/sender");

    await expect(
      sendEmail({ to: "owner@example.com", subject: "إشعار", text: "محتوى" }),
    ).rejects.toBeInstanceOf(EmailConfigurationError);
    await expect(
      sendEmail({ to: "owner@example.com", subject: "إشعار", text: "محتوى" }),
    ).rejects.toThrow("SMTP_PASSWORD");
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("never exposes SMTP secrets or a magic link when delivery fails", async () => {
    setSmtpEnvironment();
    const smtpSecretSentinel = process.env.SMTP_PASSWORD!;
    const magicLink = "https://example.test/auth/callback?token=single-use-token";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMail.mockRejectedValue(new Error(`SMTP rejected ${smtpSecretSentinel} ${magicLink}`));

    const { sendEmail, EmailDeliveryError } = await import("@/lib/email/sender");
    const delivery = sendEmail({
      to: "owner@example.com",
      subject: "رابط الدخول",
      text: magicLink,
    });

    await expect(delivery).rejects.toBeInstanceOf(EmailDeliveryError);
    await expect(delivery).rejects.toThrow("تعذر إرسال البريد عبر SMTP");
    await delivery.catch((caught: Error) => {
      expect(caught.message).not.toContain(smtpSecretSentinel);
      expect(caught.message).not.toContain(magicLink);
    });
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});
