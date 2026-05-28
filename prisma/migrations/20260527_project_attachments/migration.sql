ALTER TABLE "TimeReport"
ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'TimeReport_projectId_fkey'
      AND table_name = 'TimeReport'
  ) THEN
    ALTER TABLE "TimeReport"
    ADD CONSTRAINT "TimeReport_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TimeReport_projectId_idx" ON "TimeReport"("projectId");

CREATE TABLE IF NOT EXISTS "ProjectAttachment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "timeReportId" TEXT,
  "uploadedBy" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProjectAttachment_projectId_fkey'
      AND table_name = 'ProjectAttachment'
  ) THEN
    ALTER TABLE "ProjectAttachment"
    ADD CONSTRAINT "ProjectAttachment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProjectAttachment_timeReportId_fkey'
      AND table_name = 'ProjectAttachment'
  ) THEN
    ALTER TABLE "ProjectAttachment"
    ADD CONSTRAINT "ProjectAttachment_timeReportId_fkey"
    FOREIGN KEY ("timeReportId") REFERENCES "TimeReport"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ProjectAttachment_uploadedBy_fkey'
      AND table_name = 'ProjectAttachment'
  ) THEN
    ALTER TABLE "ProjectAttachment"
    ADD CONSTRAINT "ProjectAttachment_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectAttachment_projectId_createdAt_idx"
  ON "ProjectAttachment"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectAttachment_timeReportId_createdAt_idx"
  ON "ProjectAttachment"("timeReportId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectAttachment_uploadedBy_createdAt_idx"
  ON "ProjectAttachment"("uploadedBy", "createdAt");
