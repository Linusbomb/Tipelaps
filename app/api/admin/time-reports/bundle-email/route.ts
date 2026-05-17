import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { buildTimeReportsZipBuffer } from '@/lib/reportBundleZip'
import { sendTimeReportBundleEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const BUNDLE_ALLOWED_STATUS = ['SUBMITTED', 'APPROVED'] as const

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    const toEmail = typeof body?.toEmail === 'string' ? body.toEmail.trim() : ''
    const subject =
      typeof body?.subject === 'string' && body.subject.trim()
        ? body.subject.trim()
        : 'Underlag tidrapporter'
    const message =
      typeof body?.personalMessage === 'string' ? body.personalMessage.trim() : ''

    const saveCustomerEmail = Boolean(body?.saveCustomerEmail)
    const customerId = typeof body?.customerId === 'string' ? body.customerId.trim() : ''

    if (!toEmail || !emailRe.test(toEmail)) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'reportIds måste vara en icke-tom lista' }, { status: 400 })
    }

    const reportIds = Array.from(
      new Set(ids.map((id: unknown) => String(id).trim()).filter(Boolean))
    )

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
        { error: 'En eller flera rapporter hittades inte eller får inte skickas' },
        { status: 400 }
      )
    }

    if (saveCustomerEmail && customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
      })
      if (customer) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { contactEmail: toEmail },
        })
      }
    }

    const { buffer, suggestedFilename } = await buildTimeReportsZipBuffer(reports)

    const companyName =
      user.ownedCompany?.name ?? user.company?.name ?? 'TimeLaps'
    const count = reports.length

    const sent = await sendTimeReportBundleEmail({
      to: toEmail,
      subject,
      companyName,
      reportCount: count,
      personalMessageHtml: message
        ? message.replace(/\n/g, '<br/>')
        : '',
      zipBuffer: buffer,
      zipFileName: suggestedFilename,
      senderDisplayName: user.name,
    })

    if (!sent) {
      return NextResponse.json(
        { error: 'E-post kunde inte skickas — kontrollera SMTP-inställningar' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, sentCount: count })
  } catch (error: any) {
    console.error('[bundle-email]', error)
    return NextResponse.json({ error: 'Kunde inte skicka e-post' }, { status: 500 })
  }
}
