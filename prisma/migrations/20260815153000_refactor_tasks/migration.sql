CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "Task"
  ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "clientVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "milestoneId" TEXT,
  ADD COLUMN "assigneeId" TEXT,
  ADD COLUMN "creatorId" TEXT;

-- Preserve existing string statuses while moving to the enum.
ALTER TABLE "Task" ADD COLUMN "status_new" "TaskStatus" NOT NULL DEFAULT 'TODO';
UPDATE "Task" SET "status_new" = CASE
  WHEN lower("status") IN ('in_progress','in progress','doing','folyamatban') THEN 'IN_PROGRESS'::"TaskStatus"
  WHEN lower("status") IN ('review','ellenőrzés','ellenorzes') THEN 'REVIEW'::"TaskStatus"
  WHEN lower("status") IN ('blocked','blokkolt') THEN 'BLOCKED'::"TaskStatus"
  WHEN lower("status") IN ('done','completed','kész','kesz') THEN 'DONE'::"TaskStatus"
  ELSE 'TODO'::"TaskStatus"
END;
ALTER TABLE "Task" DROP COLUMN "status";
ALTER TABLE "Task" RENAME COLUMN "status_new" TO "status";

-- Existing tasks are attributed to the legacy project owner so creatorId can become required.
UPDATE "Task" t
SET "creatorId" = p."ownerId"
FROM "Project" p
WHERE p."id" = t."projectId" AND t."creatorId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "creatorId" SET NOT NULL;

CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
