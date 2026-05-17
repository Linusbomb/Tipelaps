import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'E-postadress krävs' },
        { status: 400 }
      )
    }

    // Hitta användaren
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Av säkerhetsskäl skickar vi alltid samma meddelande
    // även om användaren inte finns (förhindrar e-postenumeration)
    if (!user) {
      // Vänta lite för att simulera e-postskickning
      await new Promise(resolve => setTimeout(resolve, 1000))
      return NextResponse.json({
        message: 'Om en användare med denna e-postadress finns kommer ett e-postmeddelande att skickas.',
      })
    }

    // Generera reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date()
    resetExpires.setHours(resetExpires.getHours() + 1) // Token är giltig i 1 timme

    // Spara token i databasen
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    })

    // Skapa återställningslänk
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

    // Skicka e-post
    const emailSent = await sendPasswordResetEmail(
      user.email,
      resetLink,
      user.name
    )

    if (!emailSent) {
      // Ta bort token om e-post inte kunde skickas
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })
      return NextResponse.json(
        { error: 'Kunde inte skicka e-post. Kontrollera e-postinställningarna.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Om en användare med denna e-postadress finns kommer ett e-postmeddelande att skickas.',
    })
  } catch (error: any) {
    console.error('Fel vid återställning av lösenord:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid återställning av lösenord' },
      { status: 500 }
    )
  }
}
