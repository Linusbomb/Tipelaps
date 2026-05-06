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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { name, relationship, phone, email, address } = body

    // Hämta närmsta anhörig för att kontrollera behörighet
    const nextOfKin = await prisma.nextOfKin.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!nextOfKin) {
      return NextResponse.json({ error: 'Närmsta anhörig hittades inte' }, { status: 404 })
    }

    // Kontrollera behörighet
    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR' && user.id !== nextOfKin.userId) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const updated = await prisma.nextOfKin.update({
      where: { id },
      data: {
        name,
        relationship,
        phone: phone || null,
        email: email || null,
        address: address || null,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Fel vid uppdatering av närmsta anhörig:', error)
    return NextResponse.json(
      { error: 'Kunde inte uppdatera närmsta anhörig' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { id } = params

    // Hämta närmsta anhörig för att kontrollera behörighet
    const nextOfKin = await prisma.nextOfKin.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!nextOfKin) {
      return NextResponse.json({ error: 'Närmsta anhörig hittades inte' }, { status: 404 })
    }

    // Kontrollera behörighet
    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR' && user.id !== nextOfKin.userId) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    await prisma.nextOfKin.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Närmsta anhörig borttagen' })
  } catch (error: any) {
    console.error('Fel vid borttagning av närmsta anhörig:', error)
    return NextResponse.json(
      { error: 'Kunde inte ta bort närmsta anhörig' },
      { status: 500 }
    )
  }
}
