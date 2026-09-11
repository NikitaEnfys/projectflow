import { json } from "@/lib/http/response";
import { clientRepository, projectRepository } from "@/lib/repositories";
import { clientVisibilityWhere, getCurrentAccessContext, projectVisibilityWhere } from "@/lib/auth/access";

export async function GET() {
  const { user, oversightOrganizationIds, linkedClientIds } = await getCurrentAccessContext();
  const [projects, clients] = await Promise.all([
    projectRepository.findMany({
      where: projectVisibilityWhere(user.id, oversightOrganizationIds, linkedClientIds),
      include: { client: true, owner: true },
      orderBy: { createdAt: "desc" },
    }),
    clientRepository.findMany({
      where: clientVisibilityWhere(user.id, oversightOrganizationIds),
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return json({
    user: { id: user.id, name: user.name, email: user.email },
    organizationCount: user.memberships.length,
    projects,
    clientCount: clients.length,
  });
}
