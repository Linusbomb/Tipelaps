import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isEmployeeDocumentType } from '@/lib/employeeDocuments'
import { parseDateOnlyToStorage } from '@/lib/parseDateOnlyLocal'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { requireCompanyModuleAccess } from '@/lib/companyModuleAccess'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

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

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateOnlyToStorage(trimmed)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function canAccessEmployeeDocuments(
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>,
  targetUserId: string
) {
  if (targetUserId === user.id) return true
  if (!ADMIN_ROLES.has(user.role)) return false

  const adminCompanyId = adminEffectiveCompanyId(user)
  if (!adminCompanyId) return false

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { companyId: true, employmentEndedAt: true },
  })

  return Boolean(
    targetUser && !targetUser.employmentEndedAt && targetUser.companyId === adminCompanyId
  )
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCompanyModuleAccess(request, 'employee_docs')
    if (!access.ok) return access.response
    const user = access.user

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id

    if (!(await canAccessEmployeeDocuments(user, userId))) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error: unknown) {
    console.error('Fel vid hämtning av dokument:', error)
    return NextResponse.json({ error: 'Kunde inte hämta dokument' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCompanyModuleAccess(request, 'employee_docs')
    if (!access.ok) return access.response
    const user = access.user

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = String(formData.get('type') || '').trim()
    const title = String(formData.get('title') || '').trim()
    const userId = String(formData.get('userId') || '').trim()
    const expiryDate = formData.get('expiryDate') as string | null
    const issuedDate = formData.get('issuedDate') as string | null
    const description = String(formData.get('description') || '').trim()

    if (!file || !type || !title || !userId) {
      return NextResponse.json(
        { error: 'Fil, typ, titel och användar-ID krävs' },
        { status: 400 }
      )
    }

    if (!isEmployeeDocumentType(type)) {
      return NextResponse.json({ error: 'Ogiltig dokumenttyp' }, { status: 400 })
    }

    if (!(await canAccessEmployeeDocuments(user, userId))) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Filen får vara högst 10 MB' }, { status: 400 })
    }

    const uploadsDir = join(process.cwd(), 'uploads', userId)
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const originalName = file.name
    const fileName = `${timestamp}-${originalName}`
    const filePath = join(uploadsDir, fileName)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    const document = await prisma.employeeDocument.create({
      data: {
        userId,
        type,
        title,
        fileName: originalName,
        filePath: `uploads/${userId}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        expiryDate: parseOptionalDate(expiryDate),
        issuedDate: parseOptionalDate(issuedDate),
        description: description || null,
        uploadedBy: user.id,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error: unknown) {
    console.error('Fel vid uppladdning av dokument:', error)
    return NextResponse.json({ error: 'Kunde inte ladda upp dokument' }, { status: 500 })
  }
}
