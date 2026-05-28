import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { isAbsenceType } from '@/lib/absence'
import { parseDateOnlyLocal } from '@/lib/parseDateOnlyLocal'
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

    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        userId: string
        date: Date
        year: number
        month: string
        type: string
        isFullDay: boolean
        hours: number | null
        note: string | null
        status: string
        submittedAt: Date | null
        approvedAt: Date | null
        approvedBy: string | null
        createdAt: Date
        updatedAt: Date
      }>
    >`
      SELECT *
      FROM "AbsenceReport"
      WHERE "userId" = ${subject.reportUserId}
        AND (${month}::text IS NULL OR "month" = ${month})
        AND (
          ${status}::text IS NULL
          OR ${status} = 'ALL'
          OR "status" = ${status}
        )
      ORDER BY "date" DESC, "createdAt" DESC
    `

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

    const reportDate = parseDateOnlyLocal(String(date))
    const month = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`
    const id = randomUUID()
    const now = new Date()
    const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null

    await prisma.$executeRaw`
      INSERT INTO "AbsenceReport" (
        "id", "userId", "date", "year", "month", "type", "isFullDay", "hours",
        "note", "status", "createdAt", "updatedAt"
      )
      VALUES (
        ${id}, ${subject.reportUserId}, ${reportDate}, ${reportDate.getFullYear()}, ${month},
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
