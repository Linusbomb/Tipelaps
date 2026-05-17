import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'

export const dynamic = 'force-dynamic'

const BUNDLE_ALLOWED_STATUS = ['SUBMITTED', 'APPROVED'] as const

/** Marginal i dagar efter senaste slutfört datum för att fånga försenade tidrapporter. */
const DAYS_AFTER_LAST_COMPLETION = 62

type ProjectInfo = {
  id: string
  name: string
  startDate: Date
  endBoundary: Date
  userIds: Set<string>
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAdminApiUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast för admin' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const customerId = request.nextUrl.searchParams.get('customerId')
    const employeeId = request.nextUrl.searchParams.get('employeeId')
    const monthParam = request.nextUrl.searchParams.get('month')?.trim() ?? ''
    const projectIdsRaw = request.nextUrl.searchParams.get('projectIds')?.trim() ?? ''

    if (!customerId?.trim()) {
      return NextResponse.json({ error: 'customerId krävs' }, { status: 400 })
    }

    if (monthParam && !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'Ogiltigt månad — använd formatet YYYY-MM' }, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    const projectsRaw = await prisma.project.findMany({
      where: { companyId, customerId },
      select: {
        id: true,
        name: true,
        startDate: true,
        employees: {
          select: { userId: true, completedAt: true },
        },
      },
      orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
    })

    const projectInfos: ProjectInfo[] = projectsRaw.map((p) => {
      const start = new Date(p.startDate)
      start.setHours(0, 0, 0, 0)

      const completionTimes = p.employees
        .map((e) => e.completedAt)
        .filter((t): t is Date => t != null && !Number.isNaN(new Date(t).getTime()))
        .map((t) => new Date(t).getTime())

      const latest = completionTimes.length > 0 ? Math.max(...completionTimes) : Date.now()
      const end = new Date(latest)
      end.setHours(23, 59, 59, 999)
      end.setDate(end.getDate() + DAYS_AFTER_LAST_COMPLETION)

      return {
        id: p.id,
        name: p.name,
        startDate: start,
        endBoundary: end,
        userIds: new Set(p.employees.map((e) => e.userId)),
      }
    })

    const projectsForResponse = projectInfos.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate.toISOString(),
      endBoundary: p.endBoundary.toISOString(),
      assignedEmployeeCount: p.userIds.size,
    }))

    const requestedProjectIds = projectIdsRaw
      ? Array.from(new Set(projectIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)))
      : []

    const selectedProjects = requestedProjectIds.length
      ? projectInfos.filter((p) => requestedProjectIds.includes(p.id))
      : []

    if (requestedProjectIds.length > 0 && selectedProjects.length === 0) {
      return NextResponse.json({
        reports: [],
        employees: [],
        projects: projectsForResponse,
        customer: {
          id: customer.id,
          name: customer.name,
          contactEmail: customer.contactEmail,
        },
      })
    }

    const baseWhere: any = {
      customerId,
      status: { in: [...BUNDLE_ALLOWED_STATUS] },
      totalHours: { gt: 0 },
      user: { companyId },
      ...(monthParam ? { month: monthParam } : {}),
    }

    if (selectedProjects.length > 0) {
      const userIdSet = new Set<string>()
      for (const p of selectedProjects) {
        for (const id of Array.from(p.userIds)) userIdSet.add(id)
      }
      if (userIdSet.size === 0) {
        return NextResponse.json({
          reports: [],
          employees: [],
          projects: projectsForResponse,
          customer: {
            id: customer.id,
            name: customer.name,
            contactEmail: customer.contactEmail,
          },
          projectFilterEmpty: true,
        })
      }

      baseWhere.userId = { in: Array.from(userIdSet) }
      baseWhere.OR = selectedProjects.map((p) => ({
        userId: { in: Array.from(p.userIds) },
        date: { gte: p.startDate, lte: p.endBoundary },
      }))
    }

    const forEmployees = await prisma.timeReport.findMany({
      where: baseWhere,
      distinct: ['userId'],
      select: {
        userId: true,
        user: { select: { id: true, name: true } },
      },
    })

    const byEmp = new Map<string, string>()
    for (const r of forEmployees) {
      byEmp.set(r.user.id, r.user.name)
    }
    const whereReports: any = { ...baseWhere }
    if (employeeId?.trim()) {
      whereReports.userId = employeeId.trim()
      // Behåll OR-villkor för datumfönster om projektfilter aktivt – men begränsa även till anställd.
      if (selectedProjects.length > 0) {
        whereReports.OR = selectedProjects
          .filter((p) => p.userIds.has(employeeId.trim()))
          .map((p) => ({ date: { gte: p.startDate, lte: p.endBoundary } }))
        if ((whereReports.OR as any[]).length === 0) {
          // Anställd är inte tilldelad något av valda projekt → tom lista
          return NextResponse.json({
            reports: [],
            employees: Array.from(byEmp.entries())
              .map(([id, name]) => ({ id, name }))
              .sort((a, b) => a.name.localeCompare(b.name, 'sv')),
            projects: projectsForResponse,
            customer: {
              id: customer.id,
              name: customer.name,
              contactEmail: customer.contactEmail,
            },
          })
        }
      }
    }

    const rows = await prisma.timeReport.findMany({
      where: whereReports,
      select: {
        id: true,
        date: true,
        month: true,
        status: true,
        customerTotalHours: true,
        user: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'desc' }],
    })

    const employees = Array.from(byEmp.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))

    return NextResponse.json({
      reports: rows,
      employees,
      projects: projectsForResponse,
      customer: {
        id: customer.id,
        name: customer.name,
        contactEmail: customer.contactEmail,
      },
    })
  } catch (error: any) {
    console.error('[bundle-candidates]', error)
    return NextResponse.json({ error: 'Kunde inte hämta tidrapporter' }, { status: 500 })
  }
}
