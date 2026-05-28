import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { roundHours, sumEntryMachineHours } from '@/lib/projectHours'

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
        address: true,
        description: true,
        customerId: true,
        startDate: true,
        customer: { select: { name: true } },
        attachments: {
          select: { id: true, fileName: true, mimeType: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
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
    const projectPayload = {
      id: project.id,
      name: project.name,
      address: project.address,
      description: project.description,
      startDate: project.startDate.toISOString(),
      customerName: project.customer.name,
      attachments: project.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        createdAt: a.createdAt.toISOString(),
      })),
    }

    if (assignedUserIds.length === 0) {
      return NextResponse.json({
        project: projectPayload,
        reports: [],
        summary: {
          totalHours: 0,
          totalMachineHours: 0,
          hoursApproved: 0,
          hoursSubmitted: 0,
          hoursDraft: 0,
          reportCount: 0,
          linkedToProjectCount: 0,
          byStatus: {},
          byUser: [],
          draftByUser: [],
          latestCompletionAt: null,
        },
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
        OR: [
          { projectId },
          {
            projectId: null,
            customerId: project.customerId,
            userId: { in: assignedUserIds },
            date: {
              gte: startBoundary,
              lte: endBoundary,
            },
          },
        ],
      },
      select: {
        id: true,
        date: true,
        month: true,
        totalHours: true,
        status: true,
        projectId: true,
        user: {
          select: { id: true, name: true },
        },
        entries: {
          select: { machineHours: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    type UserAgg = {
      userId: string
      name: string
      hours: number
      hoursApproved: number
      hoursSubmitted: number
      hoursDraft: number
      machineHours: number
      reportCount: number
      draftReportCount: number
    }

    const byUserMap = new Map<string, UserAgg>()
    const byStatus: Record<string, number> = {}
    let totalHours = 0
    let totalMachineHours = 0
    let hoursApproved = 0
    let hoursSubmitted = 0
    let hoursDraft = 0

    for (const report of reports) {
      const hours = report.totalHours ?? 0
      const machineHours = sumEntryMachineHours(report.entries)
      totalHours += hours
      totalMachineHours += machineHours
      byStatus[report.status] = (byStatus[report.status] ?? 0) + hours
      if (report.status === 'APPROVED') hoursApproved += hours
      else if (report.status === 'SUBMITTED') hoursSubmitted += hours
      else if (report.status === 'DRAFT') hoursDraft += hours

      const prev = byUserMap.get(report.user.id) ?? {
        userId: report.user.id,
        name: report.user.name,
        hours: 0,
        hoursApproved: 0,
        hoursSubmitted: 0,
        hoursDraft: 0,
        machineHours: 0,
        reportCount: 0,
        draftReportCount: 0,
      }
      prev.hours += hours
      prev.machineHours += machineHours
      prev.reportCount += 1
      if (report.status === 'APPROVED') prev.hoursApproved += hours
      else if (report.status === 'SUBMITTED') prev.hoursSubmitted += hours
      else if (report.status === 'DRAFT') {
        prev.hoursDraft += hours
        prev.draftReportCount += 1
      }
      byUserMap.set(report.user.id, prev)
    }

    const byUser = Array.from(byUserMap.values())
      .map((row) => ({
        ...row,
        hours: roundHours(row.hours),
        hoursApproved: roundHours(row.hoursApproved),
        hoursSubmitted: roundHours(row.hoursSubmitted),
        hoursDraft: roundHours(row.hoursDraft),
        machineHours: roundHours(row.machineHours),
      }))
      .sort((a, b) => b.hours - a.hours)

    const draftByUser = byUser
      .filter((row) => row.draftReportCount > 0)
      .map((row) => ({
        userId: row.userId,
        name: row.name,
        hours: row.hoursDraft,
        reportCount: row.draftReportCount,
      }))
      .sort((a, b) => b.hours - a.hours)

    const latestCompletionAt =
      completionTimes.length > 0 ? new Date(latestCompletionMs).toISOString() : null

    return NextResponse.json({
      project: projectPayload,
      reports,
      summary: {
        totalHours: roundHours(totalHours),
        totalMachineHours: roundHours(totalMachineHours),
        hoursApproved: roundHours(hoursApproved),
        hoursSubmitted: roundHours(hoursSubmitted),
        hoursDraft: roundHours(hoursDraft),
        reportCount: reports.length,
        linkedToProjectCount: reports.filter((r) => r.projectId === projectId).length,
        byStatus,
        byUser,
        draftByUser,
        latestCompletionAt,
      },
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
