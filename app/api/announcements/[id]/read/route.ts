import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { announcementApiErrorMessage, isAnnouncementActiveOnDate } from '@/lib/announcements'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Inget företag kopplat' }, { status: 400 })
    }

    const announcement = await prisma.companyAnnouncement.findFirst({
      where: {
        id: params.id,
        companyId,
        archivedAt: null,
        OR: [{ audienceAll: true }, { recipients: { some: { userId: user.id } } }],
      },
    })

    if (!announcement || !isAnnouncementActiveOnDate(announcement)) {
      return NextResponse.json({ error: 'Nyhet hittades inte' }, { status: 404 })
    }

    const read = await prisma.companyAnnouncementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: params.id,
          userId: user.id,
        },
      },
      create: {
        announcementId: params.id,
        userId: user.id,
      },
      update: {},
    })

    return NextResponse.json({ readAt: read.readAt.toISOString() })
  } catch (error: unknown) {
    console.error('Fel vid markering av läst nyhet:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'markera nyhet som läst') },
      { status: 500 }
    )
  }
}
