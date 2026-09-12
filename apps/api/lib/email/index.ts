import type { EmailProvider } from "./provider";
import { SmtpEmailProvider } from "./smtp-provider";

let providerInstance: EmailProvider | null = null;

/**
 * Central email-provider factory.
 *
 * Business services must import getEmailProvider() instead of importing
 * a concrete provider directly. This is the boundary that makes later
 * production migrations cheap.
 *
 * Today:
 *   EMAIL_PROVIDER=smtp -> SmtpEmailProvider
 *
 * Later, an API-based production adapter can be added without changing
 * InvitationService / NotificationService, for example:
 *   EMAIL_PROVIDER=ses -> SesEmailProvider
 */
export function getEmailProvider(): EmailProvider {
  if (providerInstance) return providerInstance;

  const provider = (process.env.EMAIL_PROVIDER ?? "smtp").trim().toLowerCase();

  switch (provider) {
    case "smtp":
      providerInstance = new SmtpEmailProvider();
      return providerInstance;

    default:
      throw new Error(`Ismeretlen EMAIL_PROVIDER: ${provider}`);
  }
}
