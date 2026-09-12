-- Add approval-aware task status.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';

-- Approval decisions.
DO $$
BEGIN
  CREATE TYPE "TaskApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "TaskApproval" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "decision" "TaskApprovalDecision" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskApproval_taskId_approverId_key"
ON "TaskApproval"("taskId", "approverId");

CREATE INDEX IF NOT EXISTS "TaskApproval_taskId_idx"
ON "TaskApproval"("taskId");

CREATE INDEX IF NOT EXISTS "TaskApproval_approverId_idx"
ON "TaskApproval"("approverId");

CREATE INDEX IF NOT EXISTS "TaskApproval_decision_idx"
ON "TaskApproval"("decision");

DO $$
BEGIN
  ALTER TABLE "TaskApproval"
  ADD CONSTRAINT "TaskApproval_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "TaskApproval"
  ADD CONSTRAINT "TaskApproval_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
