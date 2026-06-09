-- CreateTable
CREATE TABLE "CompanyFeature" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledBy" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFeature_companyId_moduleId_key" ON "CompanyFeature"("companyId", "moduleId");

-- CreateIndex
CREATE INDEX "CompanyFeature_companyId_enabled_idx" ON "CompanyFeature"("companyId", "enabled");

-- AddForeignKey
ALTER TABLE "CompanyFeature" ADD CONSTRAINT "CompanyFeature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Startpaket: alla moduler på för befintliga företag
INSERT INTO "CompanyFeature" ("id", "companyId", "moduleId", "enabled", "enabledAt", "updatedAt")
SELECT
    md5(c."id" || ':' || m."moduleId"),
    c."id",
    m."moduleId",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (
    VALUES
        ('time_reports'),
        ('projects'),
        ('vehicles'),
        ('announcements'),
        ('payroll'),
        ('customer_portal'),
        ('employee_docs'),
        ('vacation')
) AS m("moduleId")
ON CONFLICT ("companyId", "moduleId") DO NOTHING;
