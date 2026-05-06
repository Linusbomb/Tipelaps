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

    // Endast för anställda (EMPLOYEE) - de kan se alla i samma företag
    if (user.role !== 'EMPLOYEE' || !user.companyId) {
      return NextResponse.json({ error: 'Endast anställda kan se kontakter' }, { status: 403 })
    }

    // Hämta alla anställda i samma företag, inklusive chefer och lönesamordnare
    const contacts = await prisma.user.findMany({
      where: {
        companyId: user.companyId,
        // Inkludera alla roller i samma företag
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profileImagePath: true,
        role: true, // För att kunna visa om det är chef eller anställd
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(contacts)
  } catch (error: any) {
    console.error('Fel vid hämtning av kontakter:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta kontakter' },
      { status: 500 }
    )
  }
}
