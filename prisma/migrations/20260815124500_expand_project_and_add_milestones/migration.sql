-- Project management foundation: lifecycle, scheduling, priority and progress.
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "Project"
  ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
  ADD COLUMN "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);

CREATE TABLE "Milestone" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

ALTER TABLE "Milestone"
  ADD CONSTRAINT "Milestone_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
