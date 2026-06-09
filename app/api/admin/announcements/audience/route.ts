import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { company: true, ownedCompany: true },
    })
    if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json([])
    }

    const people = await prisma.user.findMany({
      where: {
        companyId,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR', 'ENTREPRENEUR'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(people)
  } catch (error: unknown) {
    console.error('Fel vid hämtning av målgrupp:', error)
    return NextResponse.json({ error: 'Kunde inte hämta personal' }, { status: 500 })
  }
}
