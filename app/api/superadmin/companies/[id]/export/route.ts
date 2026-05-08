import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const companyId = params.id
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const [employees, customers, projects, timeReports, documents, kin, vacation] =
    await Promise.all([
      prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          employeeCategory: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          employmentEndedAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.customer.findMany({ where: { companyId } }),
      prisma.project.findMany({
        where: { companyId },
        include: { employees: true },
      }),
      prisma.timeReport.findMany({
        where: { user: { companyId } },
        include: { entries: true, customer: { select: { id: true, name: true } } },
      }),
      prisma.employeeDocument.findMany({ where: { user: { companyId } } }),
      prisma.nextOfKin.findMany({ where: { user: { companyId } } }),
      prisma.vacationWeek.findMany({ where: { companyId } }),
    ])

  await logAudit({
    action: 'DATA_EXPORT_SUPERADMIN',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    companyId,
    targetType: 'Company',
    targetId: companyId,
    details: {
      counts: {
        employees: employees.length,
        timeReports: timeReports.length,
        documents: documents.length,
      },
    },
    request,
  })

  const body = {
    exportedAt: new Date().toISOString(),
    exportedBy: superAdmin.email,
    company,
    employees,
    customers,
    projects,
    timeReports,
    documents,
    nextOfKin: kin,
    vacation,
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="timelaps-foretag-${companyId}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
