import { json } from "@/lib/http/response";
import {
  clientRepository,
  projectRepository,
} from "@/lib/repositories";
import {
  clientVisibilityWhere,
  getCurrentAccessContext,
  projectVisibilityWhere,
} from "@/lib/auth/access";

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

export async function GET() {
  const {
    user,
    oversightOrganizationIds,
    linkedProjectIds,
  } = await getCurrentAccessContext();

  const [projects, clients] = await Promise.all([
    projectRepository.findMany({
      where: projectVisibilityWhere(
        user.id,
        oversightOrganizationIds,
        linkedProjectIds,
      ),
      include: {
        client: true,
        owner: {
          select: PUBLIC_USER_SELECT,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    clientRepository.findMany({
      where: clientVisibilityWhere(
        user.id,
        oversightOrganizationIds,
      ),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    organizationCount: user.memberships.length,
    projects,
    clientCount: clients.length,
  });
}
