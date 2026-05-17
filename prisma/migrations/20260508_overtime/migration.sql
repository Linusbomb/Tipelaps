-- AlterTable
ALTER TABLE "TimeReport" ADD COLUMN IF NOT EXISTS "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OvertimeEntry" (
    "id" TEXT NOT NULL,
    "timeReportId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OvertimeEntry_timeReportId_idx" ON "OvertimeEntry"("timeReportId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OvertimeEntry_timeReportId_fkey'
    ) THEN
        ALTER TABLE "OvertimeEntry"
        ADD CONSTRAINT "OvertimeEntry_timeReportId_fkey"
        FOREIGN KEY ("timeReportId") REFERENCES "TimeReport"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
