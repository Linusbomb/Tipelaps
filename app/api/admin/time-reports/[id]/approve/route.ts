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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lÃ¶nesamordnare kan godkÃ¤nna rapporter' }, { status: 403 })
    }

    const reportId = params.id

    const report = await prisma.timeReport.findUnique({
      where: { id: reportId },
      include: { user: true },
    })

    if (!report) {
      return NextResponse.json({ error: 'Rapport hittades inte' }, { status: 404 })
    }

    if (report.user.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Du har inte behÃ¶righet att godkÃ¤nna denna rapport' }, { status: 403 })
    }

    const updatedReport = await prisma.timeReport.update({
      where: { id: reportId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    })

    return NextResponse.json(updatedReport)
  } catch (error: any) {
    console.error('Fel vid godkÃ¤nnande av rapport:', error)
    return NextResponse.json(
      { error: 'Kunde inte godkÃ¤nna rapport' },
      { status: 500 }
    )
  }
}