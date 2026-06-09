-- CreateTable
CREATE TABLE "CompanyAnnouncement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "audienceAll" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAnnouncementRecipient" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CompanyAnnouncementRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyAnnouncement_companyId_archivedAt_idx" ON "CompanyAnnouncement"("companyId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAnnouncementRecipient_announcementId_userId_key" ON "CompanyAnnouncementRecipient"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "CompanyAnnouncementRecipient_userId_idx" ON "CompanyAnnouncementRecipient"("userId");

-- AddForeignKey
ALTER TABLE "CompanyAnnouncement" ADD CONSTRAINT "CompanyAnnouncement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnnouncement" ADD CONSTRAINT "CompanyAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnnouncementRecipient" ADD CONSTRAINT "CompanyAnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CompanyAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnnouncementRecipient" ADD CONSTRAINT "CompanyAnnouncementRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
