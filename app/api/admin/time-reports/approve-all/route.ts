import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

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

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare kan godkänna rapporter' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as { reportIds?: unknown }
    const reportIds = Array.isArray(body?.reportIds)
      ? body.reportIds.filter((id): id is string => typeof id === 'string')
      : []
    if (reportIds.length === 0) {
      return NextResponse.json({ error: 'Inga rapporter att godkänna' }, { status: 400 })
    }

    const result = await prisma.timeReport.updateMany({
      where: {
        id: { in: reportIds },
        status: 'SUBMITTED',
        user: {
          companyId: user.companyId,
        },
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    })

    return NextResponse.json({ count: result.count })
  } catch (error) {
    console.error('Fel vid massgodkännande av rapporter:', error)
    return NextResponse.json({ error: 'Kunde inte godkänna alla rapporter' }, { status: 500 })
  }
}
