import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return new NextResponse('Ej auktoriserad', { status: 401 })
    }

    const { id } = params

    const document = await prisma.employeeDocument.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!document) {
      return new NextResponse('Dokument hittades inte', { status: 404 })
    }

    if (document.userId !== user.id) {
      if (!ADMIN_ROLES.has(user.role)) {
        return new NextResponse('Ej behörig', { status: 403 })
      }
      const adminCompanyId = adminEffectiveCompanyId(user)
      if (!adminCompanyId || document.user.companyId !== adminCompanyId) {
        return new NextResponse('Ej behörig', { status: 403 })
      }
    }

    // Läs filen
    const filePath = join(process.cwd(), document.filePath)
    const fileBuffer = await readFile(filePath)

    // Returnera filen
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `inline; filename="${document.fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Fel vid nedladdning av dokument:', error)
    return new NextResponse('Kunde inte ladda ner dokument', { status: 500 })
  }
}
