import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, isAdminRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * GDPR-export för hela företaget. Tillgänglig för ENTREPRENEUR/PAYROLL_COORDINATOR
 * inom det egna företaget. Multi-tenancy: filtreras strikt på user.companyId.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user || !isAdminRole(user.role) || !user.companyId) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
  }

  const companyId = user.companyId
  const [company, employees, customers, projects, timeReports, documents, kin, vacation] =
    await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
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
    action: 'DATA_EXPORT_COMPANY',
    actor: { id: user.id, email: user.email, role: user.role },
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
