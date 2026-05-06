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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare kan se denna sida' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employeeId')

    const where: any = {
      user: {
        companyId: user.companyId,
      },
    }

    if (month) {
      where.month = month
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (employeeId) {
      where.userId = employeeId
    }

    // Hämta alla rapporter från anställda i samma företag
    const reports = await prisma.timeReport.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    })

    // Lägg till userId i varje rapport för enkel gruppering
    const reportsWithUserId = reports.map(report => ({
      ...report,
      userId: report.userId,
    }))

    return NextResponse.json(reportsWithUserId)
  } catch (error: any) {
    console.error('Fel vid hämtning av tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta tidrapporter' },
      { status: 500 }
    )
  }
}
