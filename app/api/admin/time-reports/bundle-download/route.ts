import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { buildTimeReportsZipBuffer } from '@/lib/reportBundleZip'

export const dynamic = 'force-dynamic'

const BUNDLE_ALLOWED_STATUS = ['SUBMITTED', 'APPROVED'] as const

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const ids: unknown = body?.reportIds
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'reportIds måste vara en icke-tom lista' }, { status: 400 })
    }

    const reportIds = Array.from(
      new Set(ids.map((id) => String(id).trim()).filter(Boolean))
    )
    if (reportIds.length === 0) {
      return NextResponse.json({ error: 'Inga giltiga rapport-id' }, { status: 400 })
    }

    const reports = await prisma.timeReport.findMany({
      where: {
        id: { in: reportIds },
        status: { in: [...BUNDLE_ALLOWED_STATUS] },
        user: { companyId },
      },
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (reports.length !== reportIds.length) {
      return NextResponse.json(
        { error: 'En eller flera rapporter hittades inte eller får inte packas ihop' },
        { status: 400 }
      )
    }

    const { buffer, suggestedFilename } = await buildTimeReportsZipBuffer(reports)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
      },
    })
  } catch (error: any) {
    console.error('[bundle-download]', error)
    return NextResponse.json({ error: 'Kunde inte skapa arkivfil' }, { status: 500 })
  }
}
