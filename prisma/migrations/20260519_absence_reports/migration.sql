CREATE TABLE IF NOT EXISTS "AbsenceReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "year" INTEGER NOT NULL,
  "month" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isFullDay" BOOLEAN NOT NULL DEFAULT true,
  "hours" DOUBLE PRECISION,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbsenceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AbsenceReport_userId_month_idx" ON "AbsenceReport"("userId", "month");
CREATE INDEX IF NOT EXISTS "AbsenceReport_status_month_idx" ON "AbsenceReport"("status", "month");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AbsenceReport_userId_fkey'
  ) THEN
    ALTER TABLE "AbsenceReport"
    ADD CONSTRAINT "AbsenceReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;