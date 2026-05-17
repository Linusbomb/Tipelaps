import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ count: 0 })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded || typeof decoded.userId !== 'string') {
      return NextResponse.json({ count: 0 })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { ownedCompany: true, company: true },
    })

    // Endast admin och lönesamordnare kan se notifikationer
    if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
      return NextResponse.json({ count: 0 })
    }

    // Hämta företaget
    const company = user.ownedCompany || user.company
    if (!company) {
      return NextResponse.json({ count: 0 })
    }

    // Räkna antal tidrapporter med status SUBMITTED (väntar på godkännande)
    const count = await prisma.timeReport.count({
      where: {
        status: 'SUBMITTED',
        user: {
          companyId: company.id,
        },
      },
    })

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Fel vid hämtning av notifikationer:', error)
    return NextResponse.json({ count: 0 })
  }
}
