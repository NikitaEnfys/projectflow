import { json } from "@/lib/http/response";
import { OrganizationRole } from "@/lib/domain/enums";
import {
  clientRepository,
  organizationMemberRepository,
  projectMemberRepository,
  runInTransaction,
  userRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = new Set<OrganizationRole>([
  OrganizationRole.ADMIN,
  OrganizationRole.PROJECT_MANAGER,
  OrganizationRole.MEMBER,
  OrganizationRole.CONTRACTOR,
  OrganizationRole.CLIENT,
]);

async function actor(userId: string, organizationId: string) {
  return organizationMemberRepository.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

function parseRole(value: unknown) {
  return typeof value === "string" && EDITABLE.has(value as OrganizationRole)
    ? (value as OrganizationRole)
    : null;
}

function canManageRole(actorRole: OrganizationRole, role: OrganizationRole) {
  return !(actorRole === OrganizationRole.ADMIN && role === OrganizationRole.ADMIN);
}

export async function POST(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const a = await actor(currentUser.id, organizationId);

  if (!a || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(a.role)) {
    return json({ error: "Nincs jogosultságod tagot hozzáadni." }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = parseRole(body.role);

  if (!email || !role) {
    return json({ error: "Érvényes e-mail és szerepkör szükséges." }, { status: 400 });
  }

  if (!canManageRole(a.role, role)) {
    return json({ error: "Adminisztrátori szerepkört csak a tulajdonos adhat." }, { status: 403 });
  }

  const user = await userRepository.findUnique({ where: { email } });
  if (!user) {
    return json(
      { error: "Ezzel az e-mail címmel még nincs regisztrált felhasználó. Küldj neki meghívót." },
      { status: 404 },
    );
  }

  const existing = await organizationMemberRepository.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (existing) {
    return json({ error: "Ez a felhasználó már tagja a szervezetnek." }, { status: 409 });
  }

  let client: { id: string; name: string } | null = null;
  if (role === OrganizationRole.CLIENT) {
    const clientId = typeof body.clientId === "string" ? body.clientId : "";
    if (!clientId) {
      return json({ error: "Ügyfél szerepkörnél ki kell választani az ügyfélcéget." }, { status: 400 });
    }

    client = await clientRepository.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true, name: true },
    });

    if (!client) {
      return json({ error: "A kiválasztott ügyfél nem ehhez a szervezethez tartozik." }, { status: 400 });
    }
  }

  const membership = await runInTransaction(async (tx) => {
    const created = await tx.organizationMember.create({
      data: { organizationId, userId: user.id, role },
      include: { user: true },
    });

    if (role === OrganizationRole.CLIENT && client) {
      await tx.clientContact.upsert({
        where: {
          clientId_email: {
            clientId: client.id,
            email: user.email.toLowerCase(),
          },
        },
        update: {
          userId: user.id,
          name: user.name,
        },
        create: {
          clientId: client.id,
          userId: user.id,
          name: user.name,
          email: user.email.toLowerCase(),
        },
      });
    }

    return created;
  });

  return json(
    {
      ...membership,
      clientId: client?.id ?? null,
      clientName: client?.name ?? null,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const a = await actor(currentUser.id, organizationId);
  if (!a || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(a.role)) {
    return json({ error: "Nincs jogosultságod." }, { status: 403 });
  }

  const body = await request.json();
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const role = parseRole(body.role);

  if (!memberId || !role) return json({ error: "Érvénytelen kérés." }, { status: 400 });

  const target = await organizationMemberRepository.findFirst({
    where: { id: memberId, organizationId },
    include: { user: true },
  });

  if (!target) return json({ error: "Tag nem található." }, { status: 404 });
  if (target.role === OrganizationRole.OWNER) {
    return json({ error: "A tulajdonos szerepköre itt nem módosítható." }, { status: 400 });
  }

  if (
    a.role === OrganizationRole.ADMIN &&
    (target.role === OrganizationRole.ADMIN || role === OrganizationRole.ADMIN)
  ) {
    return json({ error: "Adminisztrátori szerepkört csak a tulajdonos kezelhet." }, { status: 403 });
  }

  const updated = await runInTransaction(async (tx) => {
    const membership = await tx.organizationMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: true },
    });

    if (target.role === OrganizationRole.CLIENT && role !== OrganizationRole.CLIENT) {
      await tx.clientContact.deleteMany({
        where: { userId: target.userId, client: { organizationId } },
      });
    }

    return membership;
  });

  return json(updated);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: organizationId } = await params;
  const currentUser = await requireCurrentUser();
  const a = await actor(currentUser.id, organizationId);

  if (!a || ![OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(a.role)) {
    return json({ error: "Nincs jogosultságod." }, { status: 403 });
  }

  const body = await request.json();
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const target = await organizationMemberRepository.findFirst({
    where: { id: memberId, organizationId },
    include: { user: true },
  });

  if (!target) return json({ error: "Tag nem található." }, { status: 404 });
  if (target.role === OrganizationRole.OWNER) {
    return json({ error: "A szervezet tulajdonosa nem távolítható el." }, { status: 400 });
  }
  if (a.role === OrganizationRole.ADMIN && target.role === OrganizationRole.ADMIN) {
    return json({ error: "Adminisztrátort csak a tulajdonos távolíthat el." }, { status: 403 });
  }

  const managedProjects = await projectMemberRepository.findMany({
    where: {
      userId: target.userId,
      role: "PROJECT_MANAGER",
      project: { organizationId },
    },
    select: { projectId: true, project: { select: { ownerId: true } } },
  });

  const replacements = new Map<string, string>();
  for (const managed of managedProjects) {
    const replacement = await projectMemberRepository.findFirst({
      where: {
        projectId: managed.projectId,
        role: "PROJECT_MANAGER",
        userId: { not: target.userId },
      },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });

    if (!replacement) {
      return json(
        { error: "A tag nem távolítható el, mert legalább egy projekt egyetlen projektvezetője." },
        { status: 400 },
      );
    }

    replacements.set(managed.projectId, replacement.userId);
  }

  await runInTransaction(async (tx) => {
    for (const managed of managedProjects) {
      if (managed.project.ownerId === target.userId) {
        await tx.project.update({
          where: { id: managed.projectId },
          data: { ownerId: replacements.get(managed.projectId)! },
        });
      }
    }

    await tx.projectMember.deleteMany({
      where: { userId: target.userId, project: { organizationId } },
    });
    await tx.clientContact.deleteMany({
      where: { userId: target.userId, client: { organizationId } },
    });
    await tx.organizationMember.delete({ where: { id: target.id } });
  });

  return json({ success: true });
}
