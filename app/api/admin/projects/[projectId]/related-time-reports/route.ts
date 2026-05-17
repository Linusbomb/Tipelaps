import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'

export const dynamic = 'force-dynamic'

/** Dagar efter senaste ”slutfört” för att täcka försenade rapporter. */
const DAYS_AFTER_LAST_COMPLETION = 62

/**
 * Lista tidrapporter som sannolikt tillhör projektet: samma kund, tilldelad personal,
 * rapportdatum från projektstart till senaste slutfört + marginal.
 * (Tidrapporter har inget projekt-id — vid flera parallella uppdrag mot samma kund kan överlapp förekomma.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await getAdminApiUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const projectId = params.projectId?.trim()
    if (!projectId) {
      return NextResponse.json({ error: 'Ogiltigt projekt' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: {
        id: true,
        name: true,
        customerId: true,
        startDate: true,
        employees: {
          select: {
            userId: true,
            completedAt: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt hittades inte' }, { status: 404 })
    }

    const assignedUserIds = Array.from(new Set(project.employees.map((e) => e.userId)))
    if (assignedUserIds.length === 0) {
      return NextResponse.json({
        project: { id: project.id, name: project.name },
        reports: [],
        hint:
          'Ingen personal tilldelad projektet — inga tidrapporter kan matchas.',
      })
    }

    const startBoundary = new Date(project.startDate)
    startBoundary.setHours(0, 0, 0, 0)

    const completionTimes = project.employees
      .map((e) => e.completedAt)
      .filter((t): t is Date => t != null && !Number.isNaN(new Date(t).getTime()))
      .map((t) => new Date(t).getTime())

    const latestCompletionMs = completionTimes.length > 0 ? Math.max(...completionTimes) : Date.now()

    const endBoundary = new Date(latestCompletionMs)
    endBoundary.setHours(23, 59, 59, 999)
    endBoundary.setDate(endBoundary.getDate() + DAYS_AFTER_LAST_COMPLETION)

    const reports = await prisma.timeReport.findMany({
      where: {
        customerId: project.customerId,
        userId: { in: assignedUserIds },
        date: {
          gte: startBoundary,
          lte: endBoundary,
        },
      },
      select: {
        id: true,
        date: true,
        month: true,
        totalHours: true,
        status: true,
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      reports,
      window: {
        from: startBoundary.toISOString(),
        to: endBoundary.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[related-time-reports]', error)
    return NextResponse.json({ error: 'Kunde inte hämta tidrapporter' }, { status: 500 })
  }
}
