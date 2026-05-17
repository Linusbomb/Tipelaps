import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { resolveTimeReportSubject } from '@/lib/timeReportSubject'

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

    const body = await request.json()
    const { month, reportId, customerId, forUserId } = body

    const subject = await resolveTimeReportSubject(userId, forUserId)
    if (!subject.ok) return subject.response

    const reportUserId = subject.reportUserId

    let targetMonth = month as string | undefined

    // Bakåtkompatibilitet: om frontend skickar reportId,
    // slå upp rapportens månad och skicka in hela månaden.
    if (!targetMonth && reportId) {
      const report = await prisma.timeReport.findFirst({
        where: {
          id: reportId,
          userId: reportUserId,
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

    const draftWhere = {
      userId: reportUserId,
      month: targetMonth,
      status: 'DRAFT' as const,
      ...(typeof customerId === 'string' && customerId.trim()
        ? { customerId: customerId.trim() }
        : {}),
    }

    const draftReports = await prisma.timeReport.findMany({
      where: draftWhere,
      include: { customer: { select: { name: true } } },
    })

    if (draftReports.length === 0) {
      const scopeHint =
        typeof customerId === 'string' && customerId.trim()
          ? ' för den valda kunden'
          : ' för denna månad'
      return NextResponse.json(
        { error: `Inga utkast att skicka in${scopeHint}` },
        { status: 400 }
      )
    }

    const updatedReports = await prisma.timeReport.updateMany({
      where: draftWhere,
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    const customerName = draftReports[0]?.customer?.name
    const scopeLabel =
      customerName && typeof customerId === 'string' && customerId.trim()
        ? ` för ${customerName}`
        : ''

    return NextResponse.json({
      message: `${updatedReports.count} tidrapporter${scopeLabel} har skickats in`,
      count: updatedReports.count,
      customerName: customerName ?? null,
    })
  } catch (error: any) {
    console.error('Fel vid inlämning av tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte skicka in tidrapporter' },
      { status: 500 }
    )
  }
}
