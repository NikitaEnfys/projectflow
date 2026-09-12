import { json } from "@/lib/http/response";
import {
  clientContactRepository,
  organizationInvitationRepository,
  userRepository,
} from "@/lib/repositories";
import { getAuthService } from "@/lib/auth/service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invitation = await organizationInvitationRepository.findUnique({
    where: { token },
    include: {
      organization: true,
      invitedBy: { select: { name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  if (!invitation) {
    return json(
      { error: "A meghívó nem található." },
      { status: 404 },
    );
  }

  const normalizedEmail = invitation.email.toLowerCase();

  const [accountExists, projectFlowUser, contact] = await Promise.all([
    getAuthService().invitedAccountExists(normalizedEmail),
    userRepository.findUnique({
      where: { email: normalizedEmail },
      select: { name: true },
    }),
    invitation.clientId
      ? clientContactRepository.findUnique({
          where: {
            clientId_email: {
              clientId: invitation.clientId,
              email: normalizedEmail,
            },
          },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const suggestedName =
    projectFlowUser?.name ||
    contact?.name ||
    normalizedEmail.split("@")[0];

  return json({
    ...invitation,
    accountExists,
    suggestedName,
  });
}
