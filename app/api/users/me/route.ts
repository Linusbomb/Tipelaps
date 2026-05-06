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

    if (await employmentHasEnded(user.id)) {
      return NextResponse.json({ error: 'Kontot är avslutat.', inactive: true }, { status: 403 })
    }

    // Hämta användarens data inklusive närmast anhörig
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImagePath: true,
        nextOfKin: {
          select: {
            id: true,
            name: true,
            relationship: true,
            phone: true,
            email: true,
            address: true,
          },
        },
      },
    })

    return NextResponse.json(userData)
  } catch (error: any) {
    console.error('Fel vid hämtning av användardata:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta användardata' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (await employmentHasEnded(user.id)) {
      return NextResponse.json({ error: 'Kontot är avslutat.', inactive: true }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, email } = body

    // Validera att namn finns
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Namn krävs' }, { status: 400 })
    }

    // Validera email om det anges
    if (email && !email.includes('@')) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 })
    }

    // Kontrollera om email redan används av annan användare
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json({ error: 'E-postadressen används redan' }, { status: 400 })
      }
    }

    // Uppdatera användaren
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : user.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImagePath: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('Fel vid uppdatering av användardata:', error)
    return NextResponse.json(
      { error: 'Kunde inte uppdatera användardata' },
      { status: 500 }
    )
  }
}
