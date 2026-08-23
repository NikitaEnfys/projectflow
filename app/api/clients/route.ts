import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientVisibilityWhere, getCurrentAccessContext } from "@/lib/auth/access";
import { canCreateClient } from "@/lib/permissions";

export async function GET() {
  const { user, oversightOrganizationIds } = await getCurrentAccessContext();
  return NextResponse.json(await prisma.client.findMany({
    where: clientVisibilityWhere(user.id, oversightOrganizationIds),
    include: { contacts: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  }));
}

export async function POST(req: Request) {
  try {
    const { user, organizationIds } = await getCurrentAccessContext();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Az ügyfél neve kötelező." }, { status: 400 });

    const requestedOrganizationId = typeof body.organizationId === "string" ? body.organizationId : null;
    const candidates = requestedOrganizationId && organizationIds.includes(requestedOrganizationId)
      ? [requestedOrganizationId]
      : organizationIds;
    let organizationId: string | null = null;
    for (const candidate of candidates) {
      if (await canCreateClient(user.id, candidate)) { organizationId = candidate; break; }
    }
    if (!organizationId) return NextResponse.json({ error: "Csak tulajdonos vagy adminisztrátor hozhat létre ügyfelet." }, { status: 403 });

    const client = await prisma.client.create({ data: { name, organizationId } });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("CLIENT_CREATE_ERROR:", error);
    return NextResponse.json({ error: "Nem sikerült létrehozni az ügyfelet.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
