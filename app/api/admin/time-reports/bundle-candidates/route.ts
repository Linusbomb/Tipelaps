import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { requireAdminCompanyModule } from '@/lib/companyModuleAccess'

export const dynamic = 'force-dynamic'

const BUNDLE_ALLOWED_STATUS = ['SUBMITTED', 'APPROVED'] as const

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminCompanyModule(request, 'customer_portal')
    if (!access.ok) return access.response
    const companyId = access.companyId

    const customerId = request.nextUrl.searchParams.get('customerId')
    const employeeId = request.nextUrl.searchParams.get('employeeId')
    const monthParam = request.nextUrl.searchParams.get('month')?.trim() ?? ''

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

    const baseWhere: any = {
      customerId,
      status: { in: [...BUNDLE_ALLOWED_STATUS] },
      user: { companyId },
      ...(monthParam ? { month: monthParam } : {}),
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
