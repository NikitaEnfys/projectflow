import { json } from "@/lib/http/response";
import { clientRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  canManageClients,
  canViewClient,
} from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

async function getManageableClient(userId: string, clientId: string) {
  const client = await clientRepository.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      _count: { select: { projects: true } },
    },
  });

  if (!client?.organizationId) return null;

  if (!(await canManageClients(userId, client.organizationId))) {
    return null;
  }

  return client;
}

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await requireCurrentUser();

  if (!(await canViewClient(user.id, id))) {
    return json(
      { error: "Nincs hozzáférésed ehhez az ügyfélhez." },
      { status: 403 },
    );
  }

  const client = await clientRepository.findUnique({
    where: { id },
    include: {
      contacts: {
        include: { user: true },
        orderBy: { name: "asc" },
      },
      projects: {
        include: { owner: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    return json({ error: "Ügyfél nem található." }, { status: 404 });
  }

  return json(client);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const client = await getManageableClient(user.id, id);

  if (!client) {
    return json(
      {
        error:
          "Csak tulajdonos, adminisztrátor vagy projektvezető módosíthat ügyfelet.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    return json({ error: "Az ügyfél neve kötelező." }, { status: 400 });
  }

  const siblings = await clientRepository.findMany({
    where: {
      organizationId: client.organizationId,
      id: { not: id },
    },
    select: { id: true, name: true },
  });

  const duplicate = siblings.find(
    (item) =>
      item.name.trim().toLocaleLowerCase("hu-HU") ===
      name.toLocaleLowerCase("hu-HU"),
  );

  if (duplicate) {
    return json(
      {
        error: `Ebben a szervezetben már létezik „${duplicate.name}” nevű ügyfél.`,
      },
      { status: 409 },
    );
  }

  return json(
    await clientRepository.update({
      where: { id },
      data: { name },
    }),
  );
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const client = await getManageableClient(user.id, id);

  if (!client) {
    return json(
      {
        error:
          "Csak tulajdonos, adminisztrátor vagy projektvezető törölhet ügyfelet.",
      },
      { status: 403 },
    );
  }

  if (client._count.projects > 0) {
    return json(
      {
        error:
          `A(z) „${client.name}” ügyfélhez még ${client._count.projects} projekt tartozik. ` +
          "Előbb töröld ezeket a projekteket.",
      },
      { status: 409 },
    );
  }

  await clientRepository.delete({ where: { id } });

  return json({ success: true });
}
