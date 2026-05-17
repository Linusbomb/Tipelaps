import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })

  if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  const companyId = user.ownedCompany?.id ?? user.companyId
  if (!companyId) return null

  return { user, companyId }
}

const MONTH_REGEX = /^\d{4}-\d{2}$/

export async function GET(request: NextRequest) {
  try {
    const auth = await getAdminUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month || !MONTH_REGEX.test(month)) {
      return NextResponse.json({ error: 'Ogiltig månad (använd YYYY-MM)' }, { status: 400 })
    }

    const staff = await prisma.user.findMany({
      where: {
        companyId: auth.companyId,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const reports = await prisma.timeReport.findMany({
      where: {
        month,
        user: { companyId: auth.companyId },
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      select: { userId: true, totalHours: true, status: true },
    })

    const byUser: Record<
      string,
      { inskickadeTimmar: number; godkandaTimmar: number; rapportCountInskickad: number; rapportCountGodkand: number }
    > = {}

    for (const r of reports) {
      if (!byUser[r.userId]) {
        byUser[r.userId] = {
          inskickadeTimmar: 0,
          godkandaTimmar: 0,
          rapportCountInskickad: 0,
          rapportCountGodkand: 0,
        }
      }
      byUser[r.userId].inskickadeTimmar += r.totalHours
      byUser[r.userId].rapportCountInskickad += 1
      if (r.status === 'APPROVED') {
        byUser[r.userId].godkandaTimmar += r.totalHours
        byUser[r.userId].rapportCountGodkand += 1
      }
    }

    const employees = staff.map((s) => {
      const agg = byUser[s.id] || {
        inskickadeTimmar: 0,
        godkandaTimmar: 0,
        rapportCountInskickad: 0,
        rapportCountGodkand: 0,
      }
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        inskickadeTimmar: Math.round(agg.inskickadeTimmar * 100) / 100,
        godkandaTimmar: Math.round(agg.godkandaTimmar * 100) / 100,
        rapportCountInskickad: agg.rapportCountInskickad,
        rapportCountGodkand: agg.rapportCountGodkand,
      }
    })

    const totalInskickat = employees.reduce((s, e) => s + e.inskickadeTimmar, 0)
    const totalGodkant = employees.reduce((s, e) => s + e.godkandaTimmar, 0)

    return NextResponse.json({
      month,
      employees,
      totals: {
        inskickadeTimmar: Math.round(totalInskickat * 100) / 100,
        godkandaTimmar: Math.round(totalGodkant * 100) / 100,
      },
    })
  } catch (error) {
    console.error('Fel vid månadssummering lön:', error)
    return NextResponse.json({ error: 'Kunde inte hämta data' }, { status: 500 })
  }
}
