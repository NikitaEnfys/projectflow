import { getEmailProvider } from "./index";

type InvitationEmailInput = {
  email: string;
  token: string;
  organizationName: string;
  invitedByName: string;
  roleLabel: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function webOrigin() {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendOrganizationInvitationEmail(input: InvitationEmailInput) {
  const provider = getEmailProvider();

  if (!provider.isConfigured()) {
    return {
      sent: false,
      warning:
        `Az email-küldés (${provider.name}) nincs konfigurálva. ` +
        "A meghívó létrejött, a link kézzel továbbra is megosztható.",
    };
  }

  const inviteUrl = `${webOrigin()}/invite/${encodeURIComponent(input.token)}`;
  const organizationName = escapeHtml(input.organizationName);
  const invitedByName = escapeHtml(input.invitedByName);
  const roleLabel = escapeHtml(input.roleLabel);
  const safeUrl = escapeHtml(inviteUrl);

  try {
    await provider.send({
      to: input.email,
      subject: `Meghívás a(z) ${input.organizationName} ProjectFlow szervezetbe`,
      text: [
        `${input.invitedByName} meghívott a(z) ${input.organizationName} ProjectFlow szervezetbe.`,
        `Szerepkör: ${input.roleLabel}`,
        `A meghívás elfogadása: ${inviteUrl}`,
        "A meghívó 7 napig érvényes.",
      ].join("\n\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172033;line-height:1.6">
          <div style="padding:24px 0">
            <div style="display:inline-block;background:#5b67f1;color:#fff;border-radius:10px;padding:8px 12px;font-weight:700">
              ProjectFlow
            </div>
          </div>

          <h1 style="font-size:24px;margin:0 0 12px">Meghívást kaptál</h1>

          <p>
            <strong>${invitedByName}</strong> meghívott a(z)
            <strong>${organizationName}</strong> szervezetbe.
          </p>

          <p>Szerepköröd: <strong>${roleLabel}</strong></p>

          <div style="margin:28px 0">
            <a
              href="${safeUrl}"
              style="display:inline-block;background:#5b67f1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600"
            >
              Meghívás elfogadása
            </a>
          </div>

          <p style="font-size:13px;color:#667085">
            A meghívó 7 napig érvényes. Ha a gomb nem működik, másold a böngészőbe ezt a címet:
          </p>

          <p style="font-size:13px;word-break:break-all;color:#667085">${safeUrl}</p>
        </div>
      `,
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Invitation email send failed via ${provider.name}:`, error);

    return {
      sent: false,
      warning:
        "A meghívó létrejött, de az email küldése nem sikerült. " +
        "A meghívólink kézzel továbbra is megosztható.",
    };
  }
}
