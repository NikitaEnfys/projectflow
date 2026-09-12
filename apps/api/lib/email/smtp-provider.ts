import nodemailer from "nodemailer";
import type { EmailProvider, SendEmailInput } from "./provider";

function envBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function envPort(value: string | undefined) {
  const port = Number(value ?? "587");
  return Number.isFinite(port) && port > 0 ? port : 587;
}

/**
 * Provider-independent SMTP adapter.
 *
 * Development:
 *   Any SMTP account/service can be used.
 *
 * Production:
 *   The same adapter can point to Amazon SES SMTP, Mailgun SMTP,
 *   Microsoft 365, SendGrid SMTP, or another SMTP provider by changing
 *   environment variables only.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  isConfigured() {
    return Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_FROM &&
      (
        envBoolean(process.env.SMTP_ALLOW_NO_AUTH) ||
        (process.env.SMTP_USER && process.env.SMTP_PASSWORD)
      ),
    );
  }

  async send(input: SendEmailInput) {
    if (!this.isConfigured()) {
      throw new Error("Az SMTP email provider nincs konfigurálva.");
    }

    const allowNoAuth = envBoolean(process.env.SMTP_ALLOW_NO_AUTH);
    const secure = envBoolean(process.env.SMTP_SECURE);
    const port = envPort(process.env.SMTP_PORT);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      ...(!allowNoAuth
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            },
          }
        : {}),
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}
