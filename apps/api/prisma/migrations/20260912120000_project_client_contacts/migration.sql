-- ProjectFlow: explicit project <-> client contact relationship.
-- Existing clients, contacts and projects are preserved.

CREATE TABLE "ProjectClientContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientContactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectClientContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectClientContact_projectId_clientContactId_key"
ON "ProjectClientContact"("projectId", "clientContactId");

CREATE INDEX "ProjectClientContact_projectId_idx"
ON "ProjectClientContact"("projectId");

CREATE INDEX "ProjectClientContact_clientContactId_idx"
ON "ProjectClientContact"("clientContactId");

CREATE INDEX "ProjectClientContact_isPrimary_idx"
ON "ProjectClientContact"("isPrimary");

CREATE INDEX IF NOT EXISTS "Client_name_idx" ON "Client"("name");

ALTER TABLE "ProjectClientContact"
ADD CONSTRAINT "ProjectClientContact_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectClientContact"
ADD CONSTRAINT "ProjectClientContact_clientContactId_fkey"
FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
