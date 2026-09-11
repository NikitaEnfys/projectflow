import { json } from "@/lib/http/response";
import { clientRepository } from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canViewClient } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  if (!(await canViewClient(user.id, id))) return json({ error: "Nincs hozzáférésed ehhez az ügyfélhez." }, { status: 403 });
  const client = await clientRepository.findUnique({
    where: { id },
    include: {
      contacts: { include: { user: true }, orderBy: { name: "asc" } },
      projects: { include: { owner: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) return json({ error: "Ügyfél nem található." }, { status: 404 });
  return json(client);
}
