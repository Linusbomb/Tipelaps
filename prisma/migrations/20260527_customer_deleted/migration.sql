ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Customer_companyId_deletedAt_idx"
ON "Customer"("companyId", "deletedAt");
