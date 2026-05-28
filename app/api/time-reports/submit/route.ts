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
    const { month, reportId, customerId, forUserId, reportIds } = body

    const subject = await resolveTimeReportSubject(userId, forUserId)
    if (!subject.ok) return subject.response

    const reportUserId = subject.reportUserId

    let targetMonth = month as string | undefined

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

    const idsFromBody = Array.isArray(reportIds)
      ? reportIds.filter((id: unknown) => typeof id === 'string' && id.trim())
      : []

    if (idsFromBody.length > 0) {
      const draftReports = await prisma.timeReport.findMany({
        where: {
          id: { in: idsFromBody },
          userId: reportUserId,
          status: 'DRAFT',
        },
        include: { customer: { select: { name: true } } },
      })

      if (draftReports.length === 0) {
        return NextResponse.json(
          { error: 'Inga valda utkast kunde skickas in (redan inskickade eller ogiltiga)' },
          { status: 400 }
        )
      }

      if (!targetMonth && draftReports[0]) {
        targetMonth = draftReports[0].month
      }

      const updatedReports = await prisma.timeReport.updateMany({
        where: {
          id: { in: draftReports.map((r) => r.id) },
          userId: reportUserId,
          status: 'DRAFT',
        },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      })

      return NextResponse.json({
        message: `${updatedReports.count} tidrapporter har skickats till admin`,
        count: updatedReports.count,
        timeReportCount: updatedReports.count,
        absenceReportCount: 0,
      })
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

    const shouldSubmitAbsence = !(typeof customerId === 'string' && customerId.trim())
    const draftAbsences = shouldSubmitAbsence
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "AbsenceReport"
          WHERE "userId" = ${reportUserId}
            AND "month" = ${targetMonth}
            AND "status" = 'DRAFT'
        `
      : []

    if (draftReports.length === 0 && draftAbsences.length === 0) {
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

    if (shouldSubmitAbsence && draftAbsences.length > 0) {
      await prisma.$executeRaw`
        UPDATE "AbsenceReport"
        SET "status" = 'SUBMITTED', "submittedAt" = ${new Date()}, "updatedAt" = ${new Date()}
        WHERE "userId" = ${reportUserId}
          AND "month" = ${targetMonth}
          AND "status" = 'DRAFT'
      `
    }

    const customerName = draftReports[0]?.customer?.name
    const scopeLabel =
      customerName && typeof customerId === 'string' && customerId.trim()
        ? ` för ${customerName}`
        : ''
    const absenceLabel = draftAbsences.length > 0 ? ` och ${draftAbsences.length} frånvarorapporter` : ''

    return NextResponse.json({
      message: `${updatedReports.count} tidrapporter${scopeLabel}${absenceLabel} har skickats till admin`,
      count: updatedReports.count + draftAbsences.length,
      timeReportCount: updatedReports.count,
      absenceReportCount: draftAbsences.length,
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
