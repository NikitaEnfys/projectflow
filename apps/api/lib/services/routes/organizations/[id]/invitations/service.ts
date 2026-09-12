import { randomUUID } from "crypto";
import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import {
  clientRepository,
  organizationInvitationRepository,
  organizationMemberRepository,
  organizationRepository,
  userRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { sendOrganizationInvitationEmail } from "@/lib/email/invitation";

const INVITABLE = new Set<OrganizationRole>([
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
  OrganizationRole.MEMBER,
  OrganizationRole.CONTRACTOR,
  OrganizationRole.CLIENT,
]);

const ROLE_LABELS: Record<OrganizationRole, string> = {
  [OrganizationRole.OWNER]: "Tulajdonos",
  [OrganizationRole.ADMIN]: "Adminisztrátor",
  [OrganizationRole.PROJECT_MANAGER]: "Projektvezető",
  [OrganizationRole.MEMBER]: "Munkatárs",
  [OrganizationRole.CONTRACTOR]: "Alvállalkozó",
  [OrganizationRole.CLIENT]: "Ügyfél",
};

type Ctx = { params: Promise<{ id: string }> };

async function manager(userId: string, organizationId: string) {
  return organizationMemberRepository.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const membership = await manager(currentUser.id, organizationId);

  if (!membership || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role)) {
    return json({ error: "Nincs jogosultságod meghívót küldeni." }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role =
    typeof body.role === "string" && INVITABLE.has(body.role as OrganizationRole)
      ? (body.role as OrganizationRole)
      : null;

  if (!email || !role) {
    return json({ error: "Érvényes e-mail és szerepkör szükséges." }, { status: 400 });
  }

  if (membership.role === OrganizationRole.ADMIN && role === OrganizationRole.ADMIN) {
    return json({ error: "Adminisztrátort csak a tulajdonos hívhat meg." }, { status: 403 });
  }

  const organization = await organizationRepository.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) return json({ error: "A szervezet nem található." }, { status: 404 });

  let clientId: string | null = null;
  if (role === OrganizationRole.CLIENT) {
    clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;

    if (!clientId) {
      return json(
        { error: "Ügyfél szerepkörnél ki kell választani az ügyfélcéget." },
        { status: 400 },
      );
    }

    const client = await clientRepository.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });

    if (!client) {
      return json(
        { error: "A kiválasztott ügyfél nem ehhez a szervezethez tartozik." },
        { status: 400 },
      );
    }
  }

  const existingUser = await userRepository.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await organizationMemberRepository.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMembership) {
      return json({ error: "Ez a felhasználó már tagja a szervezetnek." }, { status: 409 });
    }
  }

  const invitation = await organizationInvitationRepository.upsert({
    where: { organizationId_email: { organizationId, email } },
    update: {
      role,
      clientId,
      token: randomUUID(),
      invitedById: currentUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      organizationId,
      email,
      role,
      clientId,
      token: randomUUID(),
      invitedById: currentUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    include: {
      invitedBy: { select: { name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const delivery = await sendOrganizationInvitationEmail({
    invitationId: invitation.id,
    email: invitation.email,
    token: invitation.token,
    organizationName: organization.name,
    invitedByName: invitation.invitedBy.name,
    roleLabel: ROLE_LABELS[invitation.role],
  });

  return json(
    {
      ...invitation,
      clientName: invitation.client?.name ?? null,
      emailSent: delivery.sent,
      emailWarning: delivery.warning,
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const membership = await manager(currentUser.id, organizationId);

  if (!membership || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role)) {
    return json({ error: "Nincs jogosultságod." }, { status: 403 });
  }

  const body = await request.json();
  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const invitation = await organizationInvitationRepository.findFirst({
    where: { id: invitationId, organizationId },
  });

  if (!invitation) return json({ error: "Meghívó nem található." }, { status: 404 });

  await organizationInvitationRepository.delete({ where: { id: invitation.id } });
  return json({ success: true });
}
