import { json } from "@/lib/http/response";
import {
  clientContactRepository,
  projectClientContactRepository,
  projectRepository,
  runInTransaction,
} from "@/lib/repositories";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageProject } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { id: projectId } = await params;
  const currentUser = await requireCurrentUser();

  if (!(await canManageProject(currentUser.id, projectId))) {
    return json(
      { error: "Nincs jogosultságod a projekt kapcsolattartóit módosítani." },
      { status: 403 },
    );
  }

  const project = await projectRepository.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true },
  });

  if (!project) return json({ error: "Projekt nem található." }, { status: 404 });

  const body = await request.json();
  const contactIds = Array.isArray(body.clientContactIds)
    ? [...new Set(body.clientContactIds.filter((id: unknown) => typeof id === "string"))]
    : [];

  const primaryId =
    typeof body.primaryClientContactId === "string" ? body.primaryClientContactId : null;

  if (primaryId && !contactIds.includes(primaryId)) {
    return json(
      { error: "Az elsődleges kapcsolattartónak a kijelölt kapcsolattartók között kell lennie." },
      { status: 400 },
    );
  }

  if (contactIds.length) {
    const valid = await clientContactRepository.findMany({
      where: { clientId: project.clientId, id: { in: contactIds } },
      select: { id: true },
    });

    if (valid.length !== contactIds.length) {
      return json(
        { error: "A kijelölt kapcsolattartók közül legalább egy másik ügyfélhez tartozik." },
        { status: 400 },
      );
    }
  }

  const effectivePrimary = primaryId ?? contactIds[0] ?? null;

  await runInTransaction(async (tx) => {
    await tx.projectClientContact.deleteMany({ where: { projectId } });

    if (contactIds.length) {
      await tx.projectClientContact.createMany({
        data: contactIds.map((clientContactId: string) => ({
          projectId,
          clientContactId,
          isPrimary: clientContactId === effectivePrimary,
        })),
      });
    }
  });

  const links = await projectClientContactRepository.findMany({
    where: { projectId },
    include: { clientContact: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return json(links);
}
