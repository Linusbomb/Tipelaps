-- CreateTable
CREATE TABLE "CompanyAnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAnnouncementRead_announcementId_userId_key" ON "CompanyAnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "CompanyAnnouncementRead_userId_idx" ON "CompanyAnnouncementRead"("userId");

-- AddForeignKey
ALTER TABLE "CompanyAnnouncementRead" ADD CONSTRAINT "CompanyAnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CompanyAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnnouncementRead" ADD CONSTRAINT "CompanyAnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
