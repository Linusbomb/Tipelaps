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

    if (user.role !== 'ENTREPRENEUR' || !user.companyId) {
      return NextResponse.json({ error: 'Endast entreprenörer kan se alla rapporter' }, { status: 403 })
    }

    // Hämta alla rapporter från anställda i samma företag (SUBMITTED och APPROVED)
    const reports = await prisma.timeReport.findMany({
      where: {
        user: {
          companyId: user.companyId,
        },
        status: {
          in: ['SUBMITTED', 'APPROVED'], // Visa både skickade in och godkända rapporter
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(reports)
  } catch (error: any) {
    console.error('Fel vid hämtning av alla tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta tidrapporter' },
      { status: 500 }
    )
  }
}
