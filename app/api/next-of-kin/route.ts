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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId krävs' }, { status: 400 })
    }

    // Kontrollera behörighet
    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR' && user.id !== userId) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const nextOfKin = await prisma.nextOfKin.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(nextOfKin)
  } catch (error: any) {
    console.error('Fel vid hämtning av närmsta anhöriga:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta närmsta anhöriga' },
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

    const body = await request.json()
    const { userId, name, relationship, phone, email, address } = body

    if (!userId || !name || !relationship) {
      return NextResponse.json(
        { error: 'userId, name och relationship krävs' },
        { status: 400 }
      )
    }

    // Kontrollera behörighet
    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR' && user.id !== userId) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const nextOfKin = await prisma.nextOfKin.create({
      data: {
        userId,
        name,
        relationship,
        phone: phone || null,
        email: email || null,
        address: address || null,
      },
    })

    return NextResponse.json(nextOfKin, { status: 201 })
  } catch (error: any) {
    console.error('Fel vid skapande av närmsta anhörig:', error)
    return NextResponse.json(
      { error: 'Kunde inte skapa närmsta anhörig' },
      { status: 500 }
    )
  }
}
