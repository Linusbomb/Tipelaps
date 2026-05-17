import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'

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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json([])
    }

    const customers = await prisma.customer.findMany({
      where: {
        companyId,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(customers)
  } catch (error: any) {
    console.error('Fel vid hämtning av kunder:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta kunder' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    // Alla användare som tillhör ett företag kan skapa kunder
    // (både personal och chefer)

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Kundnamn krävs' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        companyId,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error: any) {
    console.error('Fel vid skapande av kund:', error)
    return NextResponse.json(
      { error: 'Kunde inte skapa kund' },
      { status: 500 }
    )
  }
}
