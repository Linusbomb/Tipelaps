import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import {
  FULL_WORK_WEEK_DAYS,
  serializeVacationDays,
  parseVacationDaysJson,
  VACATION_WORK_DAYS,
  type VacationWorkDay,
} from '@/lib/vacationPlanning'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

function normalizeDays(raw: unknown): VacationWorkDay[] | null {
  if (!Array.isArray(raw)) return null
  const valid = raw
    .map((d) => Number(d))
    .filter((d): d is VacationWorkDay => VACATION_WORK_DAYS.includes(d as VacationWorkDay))
  const unique = Array.from(new Set(valid)).sort((a, b) => a - b)
  return unique.length > 0 ? unique : null
}

function parseWeekEntries(body: {
  weekEntries?: unknown
  weeks?: unknown
}): Array<{ week: number; days: VacationWorkDay[] }> {
  if (Array.isArray(body.weekEntries)) {
    const entries: Array<{ week: number; days: VacationWorkDay[] }> = []
    for (const item of body.weekEntries) {
      if (!item || typeof item !== 'object') continue
      const week = Number((item as { week?: unknown }).week)
      if (!Number.isInteger(week) || week < 1 || week > 53) continue
      const days =
        normalizeDays((item as { days?: unknown }).days) ?? [...FULL_WORK_WEEK_DAYS]
      entries.push({ week, days })
    }
    return entries
  }

  if (Array.isArray(body.weeks)) {
    return body.weeks
      .map((w) => Number(w))
      .filter((week) => Number.isInteger(week) && week >= 1 && week <= 53)
      .map((week) => ({ week, days: [...FULL_WORK_WEEK_DAYS] }))
  }

  return []
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = user.ownedCompany?.id || user.companyId
    if (!companyId) {
      return NextResponse.json({ employees: [], vacations: [] })
    }

    const yearParam = new URL(request.url).searchParams.get('year')
    const year = Number(yearParam || new Date().getFullYear())
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      return NextResponse.json({ error: 'Ogiltigt år' }, { status: 400 })
    }

    const [employees, vacations] = await Promise.all([
      prisma.user.findMany({
        where: {
          companyId,
          employmentEndedAt: null,
          role: 'EMPLOYEE',
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.vacationWeek.findMany({
        where: {
          companyId,
          year,
        },
        select: {
          userId: true,
          week: true,
          days: true,
        },
        orderBy: [{ userId: 'asc' }, { week: 'asc' }],
      }),
    ])

    return NextResponse.json({
      employees,
      vacations: vacations.map((v) => ({
        userId: v.userId,
        week: v.week,
        days: parseVacationDaysJson(v.days),
      })),
    })
  } catch (error) {
    console.error('Fel vid hämtning av semesterplanering:', error)
    return NextResponse.json({ error: 'Kunde inte hämta semesterplanering' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = user.ownedCompany?.id || user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Företag saknas' }, { status: 400 })
    }

    const body = await request.json()
    const userId = body?.userId as string
    const year = Number(body?.year)
    const weekEntries = parseWeekEntries(body)

    if (!userId || !Number.isInteger(year)) {
      return NextResponse.json({ error: 'Anställd och år krävs' }, { status: 400 })
    }

    const employee = await prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        employmentEndedAt: null,
        role: 'EMPLOYEE',
      },
      select: { id: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Anställd hittades inte' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.vacationWeek.deleteMany({
        where: {
          companyId,
          userId,
          year,
        },
      })

      if (weekEntries.length > 0) {
        const byWeek = new Map<number, VacationWorkDay[]>()
        for (const entry of weekEntries) {
          byWeek.set(entry.week, entry.days)
        }

        await tx.vacationWeek.createMany({
          data: Array.from(byWeek.entries()).map(([week, days]) => ({
            companyId,
            userId,
            year,
            week,
            days: serializeVacationDays(days),
          })),
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fel vid sparning av semesterplanering:', error)
    return NextResponse.json({ error: 'Kunde inte spara semesterplanering' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = user.ownedCompany?.id || user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Företag saknas' }, { status: 400 })
    }

    const yearParam = new URL(request.url).searchParams.get('year')
    const year = Number(yearParam || new Date().getFullYear())
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      return NextResponse.json({ error: 'Ogiltigt år' }, { status: 400 })
    }

    await prisma.vacationWeek.deleteMany({
      where: {
        companyId,
        year,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fel vid nollställning av semesterplanering:', error)
    return NextResponse.json({ error: 'Kunde inte nollställa semesterplanering' }, { status: 500 })
  }
}
