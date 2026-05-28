import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { getPayrollStaffForCompany } from '@/lib/payrollStaff'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const decoded = verifyToken(authHeader.substring(7))
  if (!decoded) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare' }, { status: 403 })
    }

    const month = new URL(request.url).searchParams.get('month')
    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Företag saknas' }, { status: 400 })
    }

    const staff = await getPayrollStaffForCompany(companyId)
    const staffIds = staff.map((s) => s.id)
    if (staffIds.length === 0) {
      return NextResponse.json([])
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        userId: string
        date: Date
        type: string
        isFullDay: boolean
        hours: number | null
        status: string
      }>
    >`
      SELECT "id", "userId", "date", "type", "isFullDay", "hours", "status"
      FROM "AbsenceReport"
      WHERE "userId" IN (${Prisma.join(staffIds)})
        AND (${month}::text IS NULL OR "month" = ${month})
      ORDER BY "date" DESC, "createdAt" DESC
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Fel vid hämtning av frånvaro (admin):', error)
    return NextResponse.json({ error: 'Kunde inte hämta frånvaro' }, { status: 500 })
  }
}
