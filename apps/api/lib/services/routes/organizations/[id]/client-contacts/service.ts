import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import { clientContactRepository, clientRepository, organizationMemberRepository, runInTransaction, userRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string }> };

async function requireOrganizationManager(userId: string, organizationId: string) {
  const membership = await organizationMemberRepository.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  return membership && [OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(membership.role) ? membership : null;
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await requireOrganizationManager(currentUser.id, organizationId))) {
    return json({ error: "Nincs jogosultságod ügyfélkapcsolatot kezelni." }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!userId || !clientId) return json({ error: "Felhasználó és ügyfélcég szükséges." }, { status: 400 });

  const [targetMembership, client, user] = await Promise.all([
    organizationMemberRepository.findUnique({ where: { organizationId_userId: { organizationId, userId } } }),
    clientRepository.findFirst({ where: { id: clientId, organizationId } }),
    userRepository.findUnique({ where: { id: userId } }),
  ]);
  if (!targetMembership || targetMembership.role !== OrganizationRole.CLIENT) {
    return json({ error: "Csak CLIENT szerepkörű szervezeti tag rendelhető ügyfélcéghez." }, { status: 400 });
  }
  if (!client || !user) return json({ error: "A felhasználó vagy ügyfélcég nem található." }, { status: 404 });

  const contact = await runInTransaction(async (tx) => {
    await tx.clientContact.deleteMany({
      where: { userId, client: { organizationId } },
    });
    return tx.clientContact.create({
      data: { clientId, userId, name: user.name, email: user.email.toLowerCase() },
      include: { client: { select: { id: true, name: true } } },
    });
  });

  return json(contact);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  if (!(await requireOrganizationManager(currentUser.id, organizationId))) {
    return json({ error: "Nincs jogosultságod ügyfélkapcsolatot kezelni." }, { status: 403 });
  }
  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return json({ error: "Felhasználó szükséges." }, { status: 400 });
  await clientContactRepository.deleteMany({ where: { userId, client: { organizationId } } });
  return json({ success: true });
}
