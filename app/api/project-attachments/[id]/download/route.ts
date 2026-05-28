import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return new NextResponse('Ej auktoriserad', { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, ownedCompany: true },
    })
    if (!user) return new NextResponse('Ej auktoriserad', { status: 401 })
    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) return new NextResponse('Ej behörig', { status: 403 })

    const attachment = await prisma.projectAttachment.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { companyId: true } },
        timeReport: { include: { user: { select: { companyId: true } } } },
      },
    })
    if (!attachment) return new NextResponse('Bilaga hittades inte', { status: 404 })
    const belongsToCompany =
      attachment.project?.companyId === companyId ||
      attachment.timeReport?.user.companyId === companyId
    if (!belongsToCompany) return new NextResponse('Ej behörig', { status: 403 })

    const filePath = join(process.cwd(), attachment.filePath)
    const fileBuffer = await readFile(filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
      },
    })
  } catch (error) {
    console.error('Fel vid nedladdning av bilaga:', error)
    return new NextResponse('Kunde inte öppna bilagan', { status: 500 })
  }
}
