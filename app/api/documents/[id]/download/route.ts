import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true },
  })

  return user
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

    // Kontrollera behörighet
    if (document.userId !== user.id) {
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return new NextResponse('Ej behörig', { status: 403 })
      }

      if (document.user.companyId !== user.companyId) {
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
