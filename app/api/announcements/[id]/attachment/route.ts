import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import {
  getAnnouncementForAttachmentAccess,
  userCanAccessAnnouncementAttachment,
} from '@/lib/announcementAccess'
import { announcementApiErrorMessage } from '@/lib/announcements'
import {
  sanitizeAnnouncementFileName,
  validateAnnouncementFile,
} from '@/lib/announcementAttachments'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return new NextResponse('Ej auktoriserad', { status: 401 })
    }

    const announcement = await getAnnouncementForAttachmentAccess(params.id)
    if (
      !announcement ||
      !announcement.attachmentStoragePath ||
      !announcement.attachmentFileName ||
      !announcement.attachmentMimeType
    ) {
      return new NextResponse('Bilaga hittades inte', { status: 404 })
    }

    const allowed = await userCanAccessAnnouncementAttachment(user, announcement, {
      allowAdminArchived: true,
    })
    if (!allowed) {
      return new NextResponse('Ej behörig', { status: 403 })
    }

    const storagePath = announcement.attachmentStoragePath
    if (!storagePath.startsWith('uploads/announcements/')) {
      return new NextResponse('Ogiltig sökväg', { status: 403 })
    }

    const fullPath = join(process.cwd(), storagePath)
    if (!existsSync(fullPath)) {
      return new NextResponse('Filen saknas', { status: 404 })
    }

    const fileBuffer = await readFile(fullPath)
    const forceDownload = request.nextUrl.searchParams.get('download') === '1'
    const disposition = forceDownload ? 'attachment' : 'inline'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': announcement.attachmentMimeType,
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(announcement.attachmentFileName)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error: unknown) {
    console.error('Fel vid hämtning av nyhetsbilaga:', error)
    return new NextResponse('Kunde inte hämta bilaga', { status: 500 })
  }
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
    if (!companyId || !['ENTREPRENEUR', 'PAYROLL_COORDINATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const announcement = await prisma.companyAnnouncement.findUnique({
      where: { id: params.id },
    })
    if (!announcement || announcement.companyId !== companyId) {
      return NextResponse.json({ error: 'Nyhet hittades inte' }, { status: 404 })
    }
    if (announcement.archivedAt) {
      return NextResponse.json({ error: 'Arkiverade nyheter kan inte ändras.' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fil krävs' }, { status: 400 })
    }

    const validation = validateAnnouncementFile(file)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    if (announcement.attachmentStoragePath) {
      const oldPath = join(process.cwd(), announcement.attachmentStoragePath)
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => undefined)
      }
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'announcements', companyId, params.id)
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    const safeName = sanitizeAnnouncementFileName(file.name)
    const storedName = `${Date.now()}-${safeName}`
    const storagePath = `uploads/announcements/${companyId}/${params.id}/${storedName}`
    const bytes = await file.arrayBuffer()
    await writeFile(join(process.cwd(), storagePath), Buffer.from(bytes))

    const updated = await prisma.companyAnnouncement.update({
      where: { id: params.id },
      data: {
        attachmentFileName: file.name,
        attachmentStoragePath: storagePath,
        attachmentMimeType: file.type || 'application/octet-stream',
        attachmentKind: validation.kind,
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

    return NextResponse.json({
      message: 'Bilaga uppladdad',
      attachment: {
        fileName: updated.attachmentFileName,
        mimeType: updated.attachmentMimeType,
        kind: updated.attachmentKind,
      },
    })
  } catch (error: unknown) {
    console.error('Fel vid uppladdning av nyhetsbilaga:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'ladda upp bilaga') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId || !['ENTREPRENEUR', 'PAYROLL_COORDINATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const announcement = await prisma.companyAnnouncement.findUnique({
      where: { id: params.id },
    })
    if (!announcement || announcement.companyId !== companyId) {
      return NextResponse.json({ error: 'Nyhet hittades inte' }, { status: 404 })
    }
    if (announcement.archivedAt) {
      return NextResponse.json({ error: 'Arkiverade nyheter kan inte ändras.' }, { status: 400 })
    }

    if (announcement.attachmentStoragePath) {
      const fullPath = join(process.cwd(), announcement.attachmentStoragePath)
      if (existsSync(fullPath)) {
        await unlink(fullPath).catch(() => undefined)
      }
    }

    await prisma.companyAnnouncement.update({
      where: { id: params.id },
      data: {
        attachmentFileName: null,
        attachmentStoragePath: null,
        attachmentMimeType: null,
        attachmentKind: null,
      },
    })

    return NextResponse.json({ message: 'Bilaga borttagen' })
  } catch (error: unknown) {
    console.error('Fel vid borttagning av nyhetsbilaga:', error)
    return NextResponse.json(
      { error: announcementApiErrorMessage(error, 'ta bort bilaga') },
      { status: 500 }
    )
  }
}
