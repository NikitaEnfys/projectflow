import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { organizationInvitationRepository, runInTransaction } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ token: string }> };
export async function POST(_request: Request, { params }: Ctx) {
  const { token } = await params;
  const currentUser = await requireCurrentUser();
  const invitation = await organizationInvitationRepository.findUnique({ where: { token } });
  if (!invitation) return json({ error: "A meghívó nem található vagy már felhasználták." }, { status: 404 });
  if (invitation.expiresAt < new Date()) return json({ error: "A meghívó lejárt." }, { status: 410 });
  if (currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return json({ error: `Ezt a meghívót a(z) ${invitation.email} címre küldték.` }, { status: 403 });
  }
  if (invitation.role === OrganizationRole.CLIENT && !invitation.clientId) {
    return json({ error: "Az ügyfélmeghívó nincs ügyfélcéghez rendelve. Kérj új meghívót." }, { status: 400 });
  }

  await runInTransaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: currentUser.id } },
      update: { role: invitation.role },
      create: { organizationId: invitation.organizationId, userId: currentUser.id, role: invitation.role },
    });

    if (invitation.role === OrganizationRole.CLIENT && invitation.clientId) {
      await tx.clientContact.upsert({
        where: { clientId_email: { clientId: invitation.clientId, email: currentUser.email.toLowerCase() } },
        update: { userId: currentUser.id, name: currentUser.name },
        create: {
          clientId: invitation.clientId,
          userId: currentUser.id,
          name: currentUser.name,
          email: currentUser.email.toLowerCase(),
        },
      });
    }

    await tx.organizationInvitation.delete({ where: { id: invitation.id } });
  });
  return json({ success: true, organizationId: invitation.organizationId });
}
