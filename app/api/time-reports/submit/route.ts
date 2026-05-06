import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (await employmentHasEnded(userId)) {
      return NextResponse.json(
        { error: 'Ditt arbetskonto är avslutat.', inactive: true },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { month, reportId } = body

    let targetMonth = month as string | undefined

    // Bakåtkompatibilitet: om frontend skickar reportId,
    // slå upp rapportens månad och skicka in hela månaden.
    if (!targetMonth && reportId) {
      const report = await prisma.timeReport.findFirst({
        where: {
          id: reportId,
          userId,
        },
        select: {
          month: true,
        },
      })

      if (!report) {
        return NextResponse.json(
          { error: 'Tidrapporten hittades inte' },
          { status: 404 }
        )
      }

      targetMonth = report.month
    }

    if (!targetMonth) {
      return NextResponse.json(
        { error: 'Månad eller reportId krävs' },
        { status: 400 }
      )
    }

    // Hämta alla DRAFT-rapporter för månaden
    const draftReports = await prisma.timeReport.findMany({
      where: {
        userId,
        month: targetMonth,
        status: 'DRAFT',
      },
    })

    if (draftReports.length === 0) {
      return NextResponse.json(
        { error: 'Inga tidrapporter att skicka in för denna månad' },
        { status: 400 }
      )
    }

    // Uppdatera alla rapporter till SUBMITTED
    const updatedReports = await prisma.timeReport.updateMany({
      where: {
        userId,
        month: targetMonth,
        status: 'DRAFT',
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: `${updatedReports.count} tidrapporter har skickats in`,
      count: updatedReports.count,
    })
  } catch (error: any) {
    console.error('Fel vid inlämning av tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte skicka in tidrapporter' },
      { status: 500 }
    )
  }
}
