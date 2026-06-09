import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isEmployeeDocumentType } from '@/lib/employeeDocuments'
import { parseDateOnlyToStorage } from '@/lib/parseDateOnlyLocal'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateOnlyToStorage(trimmed)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function canManageDocument(
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>,
  document: { userId: string; user: { companyId: string | null } }
) {
  if (document.userId === user.id) return true
  if (!ADMIN_ROLES.has(user.role)) return false
  const adminCompanyId = adminEffectiveCompanyId(user)
  return Boolean(adminCompanyId && document.user.companyId === adminCompanyId)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Dokument hittades inte' }, { status: 404 })
    }

    if (!(await canManageDocument(user, document))) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const body = await request.json()
    const type = typeof body.type === 'string' ? body.type.trim() : document.type
    const title = typeof body.title === 'string' ? body.title.trim() : document.title

    if (!title) {
      return NextResponse.json({ error: 'Titel krävs' }, { status: 400 })
    }
    if (!isEmployeeDocumentType(type)) {
      return NextResponse.json({ error: 'Ogiltig dokumenttyp' }, { status: 400 })
    }

    const updated = await prisma.employeeDocument.update({
      where: { id: params.id },
      data: {
        type,
        title,
        expiryDate:
          body.expiryDate !== undefined ? parseOptionalDate(body.expiryDate) : document.expiryDate,
        issuedDate:
          body.issuedDate !== undefined ? parseOptionalDate(body.issuedDate) : document.issuedDate,
        description:
          body.description !== undefined
            ? body.description
              ? String(body.description).trim()
              : null
            : document.description,
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    console.error('Fel vid uppdatering av dokument:', error)
    return NextResponse.json({ error: 'Kunde inte uppdatera dokument' }, { status: 500 })
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

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Dokument hittades inte' }, { status: 404 })
    }

    if (!(await canManageDocument(user, document))) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const filePath = join(process.cwd(), document.filePath)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    await prisma.employeeDocument.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Dokument borttaget' })
  } catch (error: unknown) {
    console.error('Fel vid borttagning av dokument:', error)
    return NextResponse.json(
      { error: 'Kunde inte ta bort dokument' },
      { status: 500 }
    )
  }
}
