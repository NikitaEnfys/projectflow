import { json } from "@/lib/http/response";
import {
  clientContactRepository,
  clientRepository,
  userRepository,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageClients } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

async function requireClientManagement(userId: string, clientId: string) {
  const client = await clientRepository.findUnique({
    where: { id: clientId },
    select: { id: true, organizationId: true },
  });

  if (!client?.organizationId) return null;

  if (!(await canManageClients(userId, client.organizationId))) {
    return null;
  }

  return client;
}

export async function POST(request: Request, { params }: Ctx) {
  const { id: clientId } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await requireClientManagement(currentUser.id, clientId))) {
    return json(
      { error: "Nincs jogosultságod kapcsolattartót létrehozni." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const position =
    typeof body.position === "string" && body.position.trim()
      ? body.position.trim()
      : null;

  if (!name || !email || !email.includes("@")) {
    return json(
      { error: "Név és érvényes e-mail cím szükséges." },
      { status: 400 },
    );
  }

  const existing = await clientContactRepository.findUnique({
    where: { clientId_email: { clientId, email } },
  });

  if (existing) {
    return json(
      {
        error:
          "Ezzel az e-mail címmel már létezik kapcsolattartó ennél az ügyfélnél.",
      },
      { status: 409 },
    );
  }

  const linkedUser = await userRepository.findUnique({
    where: { email },
    select: { id: true },
  });

  const created = await clientContactRepository.create({
    data: {
      clientId,
      userId: linkedUser?.id ?? null,
      name,
      email,
      position,
    },
    include: { user: true },
  });

  return json(created, { status: 201 });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id: clientId } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await requireClientManagement(currentUser.id, clientId))) {
    return json(
      { error: "Nincs jogosultságod kapcsolattartót módosítani." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const contactId =
    typeof body.contactId === "string" ? body.contactId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const position =
    typeof body.position === "string" && body.position.trim()
      ? body.position.trim()
      : null;

  if (!contactId || !name || !email || !email.includes("@")) {
    return json(
      { error: "Érvénytelen kapcsolattartó adatok." },
      { status: 400 },
    );
  }

  const contact = await clientContactRepository.findFirst({
    where: { id: contactId, clientId },
  });

  if (!contact) {
    return json(
      { error: "Kapcsolattartó nem található." },
      { status: 404 },
    );
  }

  const duplicate = await clientContactRepository.findUnique({
    where: { clientId_email: { clientId, email } },
  });

  if (duplicate && duplicate.id !== contactId) {
    return json(
      {
        error:
          "Ezzel az e-mail címmel már létezik másik kapcsolattartó ennél az ügyfélnél.",
      },
      { status: 409 },
    );
  }

  const linkedUser = await userRepository.findUnique({
    where: { email },
    select: { id: true },
  });

  const updated = await clientContactRepository.update({
    where: { id: contactId },
    data: {
      name,
      email,
      position,
      userId: linkedUser?.id ?? null,
    },
    include: { user: true },
  });

  return json(updated);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id: clientId } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await requireClientManagement(currentUser.id, clientId))) {
    return json(
      { error: "Nincs jogosultságod kapcsolattartót törölni." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const contactId =
    typeof body.contactId === "string" ? body.contactId : "";

  const contact = await clientContactRepository.findFirst({
    where: { id: contactId, clientId },
    select: { id: true },
  });

  if (!contact) {
    return json(
      { error: "Kapcsolattartó nem található." },
      { status: 404 },
    );
  }

  await clientContactRepository.delete({
    where: { id: contact.id },
  });

  return json({ success: true });
}
