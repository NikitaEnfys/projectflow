import { prisma } from "@/lib/prisma";

export async function refreshProjectProgress(projectId: string) {
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
  ]);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
  return progress;
}
