import { NextRequest, NextResponse } from 'next/server'
import { sendMarketingContactEmail } from '@/lib/email'
import { parseMarketingContactBody } from '@/lib/marketingContact'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = parseMarketingContactBody(body)

    if (!payload) {
      return NextResponse.json(
        { error: 'Fyll i företag, namn, e-post och meddelande.' },
        { status: 400 }
      )
    }

    const sent = await sendMarketingContactEmail(payload)

    if (!sent && !process.env.MARKETING_CONTACT_EMAIL && !process.env.SMTP_USER) {
      console.info('Kundförfrågan mottagen (e-post ej konfigurerad):', payload)
    }

    if (!sent && (process.env.MARKETING_CONTACT_EMAIL || process.env.SMTP_USER)) {
      return NextResponse.json(
        { error: 'Kunde inte skicka förfrågan just nu. Försök igen eller maila oss direkt.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Tack! Vi har tagit emot din förfrågan och återkommer så snart vi kan.',
    })
  } catch (error) {
    console.error('Fel vid kundkontakt:', error)
    return NextResponse.json({ error: 'Något gick fel. Försök igen.' }, { status: 500 })
  }
}
