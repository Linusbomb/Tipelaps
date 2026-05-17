import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded || typeof decoded.userId !== 'string') return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { ownedCompany: true, company: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = user.ownedCompany?.id || user.companyId
    if (!companyId) {
      return NextResponse.json([])
    }

    const employees = await prisma.user.findMany({
      where: {
        companyId,
        employmentEndedAt: null,
        role: 'EMPLOYEE',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Fel vid hämtning av anställda:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta anställda' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Inte implementerat' }, { status: 501 })
}
