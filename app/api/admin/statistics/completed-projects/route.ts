import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getAdminWithCompany(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })

  if (!dbUser || (dbUser.role !== 'ENTREPRENEUR' && dbUser.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  const companyId = dbUser.ownedCompany?.id ?? dbUser.companyId
  if (!companyId) return null

  return companyId
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getAdminWithCompany(request)
    if (!companyId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const yearParam = request.nextUrl.searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
    if (!Number.isFinite(year) || year < 1970 || year > 2100) {
      return NextResponse.json({ error: 'Ogiltigt år' }, { status: 400 })
    }

    const rangeStart = new Date(year, 0, 1, 0, 0, 0, 0)
    const rangeEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0)

    const rows = await prisma.projectEmployee.findMany({
      where: {
        completed: true,
        completedAt: {
          gte: rangeStart,
          lt: rangeEnd,
        },
        project: { companyId },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: {
            id: true,
            name: true,
            address: true,
            description: true,
            latitude: true,
            longitude: true,
            startDate: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ completedAt: 'desc' }],
    })

    const uniqueProjectIds = new Set(rows.map((r) => r.projectId))

    const completions = rows.map((r) => ({
      projectEmployeeId: r.id,
      projectId: r.project.id,
      projectName: r.project.name,
      projectAddress: r.project.address,
      projectDescription: r.project.description ?? null,
      projectStartDate: r.project.startDate.toISOString(),
      latitude: r.project.latitude ?? null,
      longitude: r.project.longitude ?? null,
      customerId: r.project.customer?.id ?? null,
      customerName: r.project.customer?.name ?? '—',
      assignedEquipment: r.assignedEquipment ?? null,
      employeeId: r.user.id,
      employeeName: r.user.name,
      employeeEmail: r.user.email,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }))

    return NextResponse.json({
      year,
      completionCount: rows.length,
      uniqueProjectCount: uniqueProjectIds.size,
      completions,
    })
  } catch (error) {
    console.error('Fel vid hämtning av slutförda projekt:', error)
    return NextResponse.json({ error: 'Kunde inte hämta statistik' }, { status: 500 })
  }
}
