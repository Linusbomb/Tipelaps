import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'

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
    include: { company: true, ownedCompany: true },
  })

  return user
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { id } = params

    // Kontrollera behörighet
    if (id !== user.id) {
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { companyId: true, employmentEndedAt: true },
      })

      const adminCompanyId = user.ownedCompany?.id ?? user.companyId

      if (!targetUser || targetUser.companyId !== adminCompanyId) {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      if (targetUser.employmentEndedAt) {
        return NextResponse.json({ error: 'Kontot är avslutat' }, { status: 404 })
      }
    } else if (await employmentHasEnded(id)) {
      return NextResponse.json({ error: 'Kontot är avslutat' }, { status: 403 })
    }

    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profileImagePath: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Anställd hittades inte' }, { status: 404 })
    }

    return NextResponse.json(employee)
  } catch (error: any) {
    console.error('Fel vid hämtning av anställd:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta anställd' },
      { status: 500 }
    )
  }
}
