import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, loginType } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-post och lösenord krävs' },
        { status: 400 }
      )
    }

    const trimmed = email.trim()
    const lowered = trimmed.toLowerCase()

    let user = await prisma.user.findUnique({
      where: { email: trimmed },
      include: { company: true },
    })

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: lowered },
        include: { company: true },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Fel e-post eller lösenord' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Fel e-post eller lösenord' },
        { status: 401 }
      )
    }

    if (user.employmentEndedAt != null) {
      return NextResponse.json(
        {
          error:
            'Detta arbetskonto är avslutat och kan inte användas. Be din arbetsgivare skapa ett nytt konto om du återvänder.',
        },
        { status: 403 }
      )
    }

    const isAdminUser = user.role === 'ENTREPRENEUR' || user.role === 'PAYROLL_COORDINATOR'
    if (loginType === 'admin' && !isAdminUser) {
      return NextResponse.json(
        { error: 'Detta konto är Personal. Logga in via Personal-rutan istället.' },
        { status: 403 }
      )
    }
    if (loginType === 'employee' && isAdminUser) {
      return NextResponse.json(
        { error: 'Detta konto är Admin. Logga in via Admin-rutan istället.' },
        { status: 403 }
      )
    }

    const token = generateToken(user.id, user.email, user.role)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    })
  } catch (error: any) {
    console.error('Inloggningsfel:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    )
  }
}
