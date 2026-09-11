import { projectRepository, taskRepository } from "@/lib/repositories";

export async function refreshProjectProgress(projectId: string) {
  const [total, done] = await Promise.all([
    taskRepository.count({ where: { projectId } }),
    taskRepository.count({ where: { projectId, status: "DONE" } }),
  ]);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  await projectRepository.update({ where: { id: projectId }, data: { progress } });
  return progress;
}
