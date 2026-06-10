import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isProjectSelectableForTimeReport, isUserAssignedToProject } from '@/lib/projectStatus'
import { requireCompanyModuleAccess } from '@/lib/companyModuleAccess'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCompanyModuleAccess(request, 'projects')
    if (!access.ok) return access.response

    const actorId = access.user.id

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        role: true,
        companyId: true,
        ownedCompany: { select: { id: true } },
      },
    })
    if (!actor) {
      return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 })
    }

    const companyId = adminEffectiveCompanyId(actor)
    if (!companyId) {
      return NextResponse.json({ error: 'Du tillhör inget företag' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const forUserIdParam = searchParams.get('forUserId')?.trim() || ''
    const includeProjectId = searchParams.get('includeProjectId')?.trim() || ''
    const isAdmin = ADMIN_ROLES.has(actor.role)

    let targetUserId = actorId
    if (forUserIdParam && forUserIdParam !== actorId) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Du kan bara hämta projekt för dig själv' },
          { status: 403 }
        )
      }
      const target = await prisma.user.findFirst({
        where: {
          id: forUserIdParam,
          companyId,
          employmentEndedAt: null,
        },
        select: { id: true },
      })
      if (!target) {
        return NextResponse.json({ error: 'Vald person hittades inte' }, { status: 404 })
      }
      targetUserId = target.id
    }

    const projects = await prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        startDate: true,
        customer: { select: { id: true, name: true } },
        employees: { select: { userId: true, completed: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    const mapped = projects.map((project) => ({
      id: project.id,
      name: project.name,
      customerId: project.customer.id,
      customerName: project.customer.name,
      isAssigned: isUserAssignedToProject(project.employees, targetUserId),
      isActive: isProjectSelectableForTimeReport(project.employees, targetUserId),
    }))

    let result = mapped.filter((project) => project.isActive)

    if (includeProjectId && !result.some((project) => project.id === includeProjectId)) {
      const extra = mapped.find((project) => project.id === includeProjectId)
      if (extra) result = [extra, ...result]
    }

    return NextResponse.json({
      mode: isAdmin ? 'admin' : 'employee',
      projects: result,
    })
  } catch (error: unknown) {
    console.error('Fel vid hämtning av projekt för tidrapport:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta projekt' },
      { status: 500 }
    )
  }
}
