import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import {
  announcementApiErrorMessage,
  dateInputToStorage,
  mapAnnouncementRecord,
} from '@/lib/announcements'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

async function getAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
  if (!user || !ADMIN_ROLES.has(user.role)) return null
  const companyId = adminEffectiveCompanyId(user)
  if (!companyId) return null
  return { user, companyId }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const existing = await prisma.companyAnnouncement.findUnique({
      where: { id: params.id },
      include: { recipients: true },
    })
    if (!existing || existing.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Nyhet hittades inte' }, { status: 404 })
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : existing.title
    const content = typeof body.body === 'string' ? body.body.trim() : existing.body
    const audienceAll = body.audienceAll !== undefined ? body.audienceAll !== false : existing.audienceAll
    const recipientIds: string[] = Array.isArray(body.recipientIds)
      ? Array.from(
          new Set(
            body.recipientIds
              .map((id: unknown) => String(id).trim())
              .filter((id: string): id is string => Boolean(id))
          )
        )
      : existing.recipients.map((item) => item.userId)
    const startsAt =
      body.startsAt !== undefined ? dateInputToStorage(body.startsAt) : existing.startsAt
    const endsAt = body.endsAt !== undefined ? dateInputToStorage(body.endsAt) : existing.endsAt

    if (!title) {
      return NextResponse.json({ error: 'Rubrik krävs' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'Text krävs' }, { status: 400 })
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      return NextResponse.json({ error: 'Startdatum kan inte vara efter slutdatum.' }, { status: 400 })
    }
    if (!audienceAll) {
      if (!recipientIds.length) {
        return NextResponse.json({ error: 'Välj minst en person eller alla.' }, { status: 400 })
      }
      const users = await prisma.user.count({
        where: {
          id: { in: recipientIds },
          companyId: admin.companyId,
          employmentEndedAt: null,
        },
      })
      if (users !== recipientIds.length) {
        return NextResponse.json({ error: 'En eller flera valda personer är ogiltiga.' }, { status: 400 })
      }
    }

    const announcement = await prisma.$transaction(async (tx) => {
      await tx.companyAnnouncementRecipient.deleteMany({
        where: { announcementId: params.id },
      })
      return tx.companyAnnouncement.update({
        where: { id: params.id },
        data: {
          title,
          body: content,
          startsAt,
          endsAt,
          audienceAll,
          recipients: audienceAll
            ? undefined
            : {
                create: recipientIds.map((userId) => ({ userId })),
              },
        },
        include: {
          recipients: {
            select: {
              userId: true,
              user: { select: { name: true } },
            },
          },
        },
      })
    })

    return NextResponse.json(mapAnnouncementRecord(announcement))
  } catch (error: unknown) {
    console.error('Fel vid uppdatering av nyhet:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'uppdatera nyhet') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const existing = await prisma.companyAnnouncement.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true, archivedAt: true },
    })
    if (!existing || existing.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Nyhet hittades inte' }, { status: 404 })
    }

    const announcement = await prisma.companyAnnouncement.update({
      where: { id: params.id },
      data: { archivedAt: new Date() },
      include: {
        recipients: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    return NextResponse.json(mapAnnouncementRecord(announcement))
  } catch (error: unknown) {
    console.error('Fel vid arkivering av nyhet:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'ta bort nyhet') },
      { status: 500 }
    )
  }
}
