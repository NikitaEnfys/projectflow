import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { organizationInvitationRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { applyOrganizationInvitationMembership } from "@/lib/invitations/apply-membership";

type Ctx = {
  params: Promise<{ token: string }>;
};

export async function POST(
  _request: Request,
  { params }: Ctx,
) {
  const { token } = await params;
  const currentUser =
    await requireCurrentUser();

  const invitation =
    await organizationInvitationRepository.findUnique({
      where: { token },
    });

  if (!invitation) {
    return json(
      {
        error:
          "A meghívó nem található vagy már felhasználták.",
      },
      { status: 404 },
    );
  }

  if (invitation.expiresAt < new Date()) {
    return json(
      { error: "A meghívó lejárt." },
      { status: 410 },
    );
  }

  if (
    currentUser.email.toLowerCase() !==
    invitation.email.toLowerCase()
  ) {
    return json(
      {
        error: `Ezt a meghívót a(z) ${invitation.email} címre küldték.`,
      },
      { status: 403 },
    );
  }

  if (
    invitation.role ===
      OrganizationRole.CLIENT &&
    !invitation.clientId
  ) {
    return json(
      {
        error:
          "Az ügyfélmeghívó nincs ügyfélcéghez rendelve. Kérj új meghívót.",
      },
      { status: 400 },
    );
  }

  await applyOrganizationInvitationMembership({
    invitation,
    user: currentUser,
  });

  return json({
    success: true,
    organizationId:
      invitation.organizationId,
  });
}
