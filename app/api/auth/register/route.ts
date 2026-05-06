import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, companyName, role } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Namn, e-post och lösenord krävs' },
        { status: 400 }
      )
    }

    // Kontrollera om användaren redan finns
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'En användare med denna e-post finns redan' },
        { status: 400 }
      )
    }

    // Hasha lösenordet
    const hashedPassword = await hashPassword(password)

    if (role === 'ENTREPRENEUR' && companyName) {
      const existingUsers = await prisma.user.count()
      if (existingUsers > 0) {
        return NextResponse.json(
          { error: 'Publik registrering av entreprenör är stängd. Kontakta support eller använd befintligt admin-konto.' },
          { status: 403 }
        )
      }
      // Skapa entreprenör först
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'ENTREPRENEUR',
        },
      })

      // Skapa företag med ownerId
      await prisma.company.create({
        data: {
          name: companyName,
          ownerId: user.id,
        },
      })

      // Uppdatera användaren med companyId
      const company = await prisma.company.findUnique({
        where: { ownerId: user.id },
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company!.id },
      })

      return NextResponse.json({
        message: 'Konto skapat',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } else {
      // Skapa anställd
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'EMPLOYEE',
        },
      })

      return NextResponse.json({
        message: 'Konto skapat',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    }
  } catch (error: any) {
    console.error('Registreringsfel:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid registrering' },
      { status: 500 }
    )
  }
}
