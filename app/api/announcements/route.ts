import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isAnnouncementActiveOnDate, mapAnnouncementRecord } from '@/lib/announcements'
import { requireCompanyModuleAccess } from '@/lib/companyModuleAccess'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null
  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCompanyModuleAccess(request, 'announcements')
    if (!access.ok) return access.response

    const companyId = access.companyId
    const user = access.user

    const announcements = await prisma.companyAnnouncement.findMany({
      where: {
        companyId,
        archivedAt: null,
        OR: [{ audienceAll: true }, { recipients: { some: { userId: user.id } } }],
      },
      include: {
        recipients: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    })

    const active = announcements.filter((item) => isAnnouncementActiveOnDate(item))
    const readRecords = await prisma.companyAnnouncementRead.findMany({
      where: {
        userId: user.id,
        announcementId: { in: active.map((item) => item.id) },
      },
      select: { announcementId: true, readAt: true },
    })
    const readByAnnouncementId = new Map(
      readRecords.map((item) => [item.announcementId, item.readAt])
    )

    const visible = active
      .map((item) =>
        mapAnnouncementRecord(item, { readAt: readByAnnouncementId.get(item.id) ?? null })
      )
      .sort((a, b) => {
        const aUnread = a.isRead ? 1 : 0
        const bUnread = b.isRead ? 1 : 0
        if (aUnread !== bUnread) return aUnread - bUnread
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

    return NextResponse.json(visible)
  } catch (error: unknown) {
    console.error('Fel vid hämtning av nyheter:', error)
    return NextResponse.json({ error: 'Kunde inte hämta nyheter' }, { status: 500 })
  }
}
