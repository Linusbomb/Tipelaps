import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import {
  buildCustomerHoursExcelBuffer,
  monthLabelFromKey,
  type CustomerHoursReport,
} from '@/lib/customerHoursExcel'

export const dynamic = 'force-dynamic'

const BUNDLE_ALLOWED_STATUS = ['SUBMITTED', 'APPROVED'] as const

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

    const { searchParams } = request.nextUrl
    const customerId = searchParams.get('customerId')?.trim()
    const employeeId = searchParams.get('employeeId')?.trim()
    const monthParam = searchParams.get('month')?.trim() ?? ''
    const reportIdsParam = searchParams.get('reportIds')?.trim()

    if (!customerId) {
      return NextResponse.json({ error: 'customerId krävs' }, { status: 400 })
    }

    if (monthParam && !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'Ogiltigt månad — använd YYYY-MM' }, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    const baseWhere = {
      customerId,
      status: { in: [...BUNDLE_ALLOWED_STATUS] },
      user: { companyId },
      ...(monthParam ? { month: monthParam } : {}),
      ...(employeeId ? { userId: employeeId } : {}),
    }

    let whereReports: typeof baseWhere & { id?: { in: string[] } } = baseWhere

    if (reportIdsParam) {
      const ids = Array.from(
        new Set(
          reportIdsParam
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Inga giltiga rapport-id' }, { status: 400 })
      }
      whereReports = { ...baseWhere, id: { in: ids } }
    }

    const reports = await prisma.timeReport.findMany({
      where: whereReports,
      include: {
        user: { select: { name: true, email: true } },
        customer: { select: { name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    })

    if (reportIdsParam && reports.length !== whereReports.id!.in.length) {
      return NextResponse.json(
        { error: 'En eller flera rapporter hittades inte eller tillhör inte kunden' },
        { status: 400 }
      )
    }

    if (reports.length === 0) {
      return NextResponse.json(
        { error: 'Inga tidrapporter att exportera med valda filter' },
        { status: 404 }
      )
    }

    const { buffer, filename } = buildCustomerHoursExcelBuffer(
      reports as CustomerHoursReport[],
      {
        customerName: customer.name,
        monthLabel: monthParam ? monthLabelFromKey(monthParam) : undefined,
      }
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[bundle-excel]', error)
    return NextResponse.json({ error: 'Kunde inte skapa Excel-fil' }, { status: 500 })
  }
}
