import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token och lösenord krävs' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Lösenordet måste vara minst 6 tecken långt' },
        { status: 400 }
      )
    }

    // Hitta användaren med token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Token måste fortfarande vara giltig
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Ogiltig eller utgången återställningslänk' },
        { status: 400 }
      )
    }

    // Hasha det nya lösenordet
    const hashedPassword = await hashPassword(password)

    // Uppdatera lösenordet och ta bort reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    return NextResponse.json({
      message: 'Lösenordet har återställts. Du kan nu logga in med ditt nya lösenord.',
    })
  } catch (error: any) {
    console.error('Fel vid återställning av lösenord:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid återställning av lösenord' },
      { status: 500 }
    )
  }
}
