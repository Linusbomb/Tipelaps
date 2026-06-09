-- CreateTable
CREATE TABLE "CompanyVehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "equipment" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyVehicle_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TimeReportEntry" ADD COLUMN "vehicleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyVehicle_companyId_registrationNumber_key" ON "CompanyVehicle"("companyId", "registrationNumber");

-- CreateIndex
CREATE INDEX "CompanyVehicle_companyId_deletedAt_idx" ON "CompanyVehicle"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "TimeReportEntry_vehicleId_idx" ON "TimeReportEntry"("vehicleId");

-- AddForeignKey
ALTER TABLE "CompanyVehicle" ADD CONSTRAINT "CompanyVehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeReportEntry" ADD CONSTRAINT "TimeReportEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CompanyVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
