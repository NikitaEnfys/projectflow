CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAttachment_storageKey_key"
ON "TaskAttachment"("storageKey");

CREATE INDEX "TaskAttachment_taskId_idx"
ON "TaskAttachment"("taskId");

CREATE INDEX "TaskAttachment_uploadedById_idx"
ON "TaskAttachment"("uploadedById");

CREATE INDEX "TaskAttachment_visibility_idx"
ON "TaskAttachment"("visibility");

CREATE INDEX "TaskAttachment_createdAt_idx"
ON "TaskAttachment"("createdAt");

ALTER TABLE "TaskAttachment"
ADD CONSTRAINT "TaskAttachment_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAttachment"
ADD CONSTRAINT "TaskAttachment_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
