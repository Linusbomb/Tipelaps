import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, ownedCompany: true },
    })
    if (!user) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const attachment = await prisma.projectAttachment.findUnique({
      where: { id: params.id },
      include: {
        project: true,
        timeReport: { include: { user: { select: { companyId: true } } } },
      },
    })
    if (!attachment) return NextResponse.json({ error: 'Bilaga hittades inte' }, { status: 404 })

    const isAdmin = user.role === 'ENTREPRENEUR' || user.role === 'PAYROLL_COORDINATOR'
    const companyId = adminEffectiveCompanyId(user)
    const belongsToCompany =
      !!companyId &&
      (attachment.project?.companyId === companyId ||
        attachment.timeReport?.user.companyId === companyId)
    const canDeleteOwn = attachment.uploadedBy === userId
    const canAdminDelete = Boolean(isAdmin && belongsToCompany)
    if (!canDeleteOwn && !canAdminDelete) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    await prisma.projectAttachment.delete({ where: { id: attachment.id } })
    const filePath = join(process.cwd(), attachment.filePath)
    if (existsSync(filePath)) await unlink(filePath)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Fel vid borttagning av bilaga:', error)
    return NextResponse.json({ error: 'Kunde inte ta bort bilaga' }, { status: 500 })
  }
}
