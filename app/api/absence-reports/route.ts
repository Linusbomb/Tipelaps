import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { isAbsenceType } from '@/lib/absence'
import { parseDateOnlyToStorage } from '@/lib/parseDateOnlyLocal'
import { monthDateRange } from '@/lib/monthDayCoverage'
import { resolveTimeReportSubject } from '@/lib/timeReportSubject'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const decoded = verifyToken(authHeader.substring(7))
  return decoded?.userId || null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const status = searchParams.get('status')
    const forUserId = searchParams.get('forUserId')

    const subject = await resolveTimeReportSubject(userId, forUserId ?? userId)
    if (!subject.ok) return subject.response

    const dateRange = month ? monthDateRange(month) : null

    const rows = await prisma.absenceReport.findMany({
      where: {
        userId: subject.reportUserId,
        ...(dateRange ? { date: { gte: dateRange.gte, lt: dateRange.lt } } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Fel vid hämtning av frånvarorapporter:', error)
    return NextResponse.json({ error: 'Kunde inte hämta frånvaro' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const body = await request.json()
    const { date, type, isFullDay, hours, note, forUserId } = body

    const subject = await resolveTimeReportSubject(userId, forUserId)
    if (!subject.ok) return subject.response

    if (!date || !isAbsenceType(type)) {
      return NextResponse.json({ error: 'Datum och frånvarotyp krävs' }, { status: 400 })
    }

    const fullDay = Boolean(isFullDay)
    const absenceHours = fullDay ? null : Number(hours)
    if (
      !fullDay &&
      (absenceHours == null ||
        !Number.isFinite(absenceHours) ||
        absenceHours <= 0 ||
        absenceHours > 24)
    ) {
      return NextResponse.json(
        { error: 'Ange antal timmar för del av dag (1-24 h)' },
        { status: 400 }
      )
    }

    const reportDate = parseDateOnlyToStorage(String(date))
    const month = `${reportDate.getUTCFullYear()}-${String(reportDate.getUTCMonth() + 1).padStart(2, '0')}`
    const id = randomUUID()
    const now = new Date()
    const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null

    await prisma.$executeRaw`
      INSERT INTO "AbsenceReport" (
        "id", "userId", "date", "year", "month", "type", "isFullDay", "hours",
        "note", "status", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${subject.reportUserId}, ${reportDate}, ${reportDate.getUTCFullYear()}, ${month},
        ${type}, ${fullDay}, ${absenceHours}, ${trimmedNote}, 'DRAFT', ${now}, ${now}
      )
    `

    const created = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "AbsenceReport" WHERE "id" = ${id} LIMIT 1
    `

    return NextResponse.json(created[0], { status: 201 })
  } catch (error) {
    console.error('Fel vid skapande av frånvaro:', error)
    return NextResponse.json({ error: 'Kunde inte skapa frånvaro' }, { status: 500 })
  }
}
