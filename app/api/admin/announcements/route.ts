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

async function validateRecipients(companyId: string, recipientIds: string[]) {
  if (!recipientIds.length) return { ok: false as const, error: 'Välj minst en person eller alla.' }
  const users = await prisma.user.findMany({
    where: {
      id: { in: recipientIds },
      companyId,
      employmentEndedAt: null,
      role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
    },
    select: { id: true },
  })
  if (users.length !== recipientIds.length) {
    return { ok: false as const, error: 'En eller flera valda personer tillhör inte företaget.' }
  }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const announcements = await prisma.companyAnnouncement.findMany({
      where: {
        companyId: admin.companyId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      include: {
        recipients: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return NextResponse.json(
      announcements.map((item) => ({
        ...mapAnnouncementRecord(item),
        createdByName: item.createdBy.name,
      }))
    )
  } catch (error: unknown) {
    console.error('Fel vid hämtning av admin-nyheter:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'hämta nyheter') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const content = typeof body.body === 'string' ? body.body.trim() : ''
    const audienceAll = body.audienceAll !== false
    const recipientIds: string[] = Array.isArray(body.recipientIds)
      ? Array.from(
          new Set(
            body.recipientIds
              .map((id: unknown) => String(id).trim())
              .filter((id: string): id is string => Boolean(id))
          )
        )
      : []
    const startsAt = dateInputToStorage(body.startsAt)
    const endsAt = dateInputToStorage(body.endsAt)

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
      const validation = await validateRecipients(admin.companyId, recipientIds)
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    const announcement = await prisma.companyAnnouncement.create({
      data: {
        companyId: admin.companyId,
        title,
        body: content,
        startsAt,
        endsAt,
        audienceAll,
        createdById: admin.user.id,
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

    return NextResponse.json(mapAnnouncementRecord(announcement), { status: 201 })
  } catch (error: unknown) {
    console.error('Fel vid skapande av nyhet:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'skapa nyhet') },
      { status: 500 }
    )
  }
}
