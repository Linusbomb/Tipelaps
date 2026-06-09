import { prisma } from '@/lib/prisma'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isAnnouncementActiveOnDate } from '@/lib/announcements'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

type AuthUser = {
  id: string
  role: string
  companyId: string | null
  company?: { id: string } | null
  ownedCompany?: { id: string } | null
}

export async function userCanAccessAnnouncementAttachment(
  user: AuthUser,
  announcement: {
    id: string
    companyId: string
    archivedAt: Date | null
    audienceAll: boolean
    startsAt: Date | null
    endsAt: Date | null
    recipients?: Array<{ userId: string }>
  },
  options?: { allowAdminArchived?: boolean }
): Promise<boolean> {
  const companyId = adminEffectiveCompanyId(user)
  if (!companyId || companyId !== announcement.companyId) return false

  if (ADMIN_ROLES.has(user.role)) {
    return options?.allowAdminArchived ? true : !announcement.archivedAt
  }

  if (announcement.archivedAt) return false
  if (!isAnnouncementActiveOnDate(announcement)) return false

  if (announcement.audienceAll) return true
  return Boolean(announcement.recipients?.some((item) => item.userId === user.id))
}

export async function getAnnouncementForAttachmentAccess(announcementId: string) {
  return prisma.companyAnnouncement.findUnique({
    where: { id: announcementId },
    include: {
      recipients: { select: { userId: true } },
    },
  })
}
