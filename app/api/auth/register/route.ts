import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, companyName, role, consentAccepted } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Namn, e-post och lösenord krävs' },
        { status: 400 }
      )
    }

    if (consentAccepted !== true) {
      return NextResponse.json(
        {
          error:
            'Du måste godkänna integritetspolicyn och användarvillkoren för att skapa ett konto',
        },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'En användare med denna e-post finns redan' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    if (role === 'ENTREPRENEUR') {
      if (!companyName?.trim()) {
        return NextResponse.json(
          { error: 'Företagsnamn krävs för administratörskonto' },
          { status: 400 }
        )
      }
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'ENTREPRENEUR',
        },
      })

      const company = await prisma.company.create({
        data: {
          name: companyName,
          ownerId: user.id,
        },
      })

      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
      })

      await logAudit({
        action: 'REGISTER_ENTREPRENEUR',
        actor: { id: user.id, email: user.email, role: user.role },
        companyId: company.id,
        targetType: 'Company',
        targetId: company.id,
        details: { companyName: company.name, consentAccepted: true },
        request,
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
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || null,
          role: 'EMPLOYEE',
        },
      })

      await logAudit({
        action: 'REGISTER_EMPLOYEE',
        actor: { id: user.id, email: user.email, role: user.role },
        details: { consentAccepted: true },
        request,
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
