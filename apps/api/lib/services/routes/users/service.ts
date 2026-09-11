import { json } from "@/lib/http/response";
import { userRepository } from "@/lib/repositories";
import { getCurrentAccessContext } from "@/lib/auth/access";
import { OrganizationRole } from "@/lib/domain/enums";

export async function GET() {
  const { oversightOrganizationIds } = await getCurrentAccessContext();
  const users = await userRepository.findMany({
    where: { memberships: { some: { organizationId: { in: oversightOrganizationIds } } } },
    orderBy: { name: "asc" },
  });
  return json(users);
}

export async function POST(req: Request) {
  try {
    const { user } = await getCurrentAccessContext();
    const adminMembership = user.memberships.find((m) => m.role === OrganizationRole.OWNER || m.role === OrganizationRole.ADMIN);
    if (!adminMembership) return json({ error: "Nincs jogosultságod felhasználó létrehozásához." }, { status: 403 });
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!name || !email) return json({ error: "A név és az e-mail cím kötelező." }, { status: 400 });
    const created = await userRepository.create({ data: { name, email, memberships: { create: { organizationId: adminMembership.organizationId, role: "MEMBER" } } } });
    return json(created, { status: 201 });
  } catch (error) {
    return json({ error: "Nem sikerült létrehozni a felhasználót.", details: error instanceof Error ? error.message : "Ismeretlen hiba" }, { status: 500 });
  }
}
