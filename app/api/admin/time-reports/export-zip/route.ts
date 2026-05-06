import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import JSZip from 'jszip'
import { generateReportHTML } from '@/lib/reportExportHtml'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true },
  })

  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast chefer och lönesamordnare kan exportera' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM format

    const where: any = {
      user: {
        companyId: user.companyId,
      },
      status: 'APPROVED', // Bara exportera godkända rapporter
    }

    if (month) {
      where.month = month
    }

    // Hämta alla godkända rapporter
    const reports = await prisma.timeReport.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        entries: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    })

    if (reports.length === 0) {
      return NextResponse.json({ error: 'Inga tidrapporter att exportera' }, { status: 404 })
    }

    // Skapa ZIP-fil
    const zip = new JSZip()

    // Gruppera rapporter per månad
    const reportsByMonth: Record<string, any[]> = {}
    reports.forEach((report) => {
      const monthKey = report.month || format(new Date(report.date), 'yyyy-MM')
      if (!reportsByMonth[monthKey]) {
        reportsByMonth[monthKey] = []
      }
      reportsByMonth[monthKey].push(report)
    })

    // Skapa mappar för varje månad och lägg till tidrapporterna
    for (const [monthKey, monthReports] of Object.entries(reportsByMonth)) {
      const monthName = format(new Date(`${monthKey}-01`), 'MMMM yyyy', { locale: sv })
      const monthFolder = zip.folder(monthName)

      if (!monthFolder) continue

      // Lägg till varje tidrapport i månadsmappen
      for (const report of monthReports) {
        const reportDate = format(new Date(report.date), 'yyyy-MM-dd')
        const customerName = report.customer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const employeeName = report.user.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const fileName = `tidrapport-${employeeName}-${customerName}-${reportDate}.html`
        
        const html = generateReportHTML(report)
        monthFolder.file(fileName, html)
      }
    }

    // Generera ZIP-fil
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const buffer = Buffer.from(zipBuffer)

    const fileName = month 
      ? `tidrapporter-${month}.zip`
      : `tidrapporter-alla-${format(new Date(), 'yyyy-MM-dd')}.zip`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Fel vid export av tidrapporter som ZIP:', error)
    return NextResponse.json(
      { error: 'Kunde inte exportera tidrapporter' },
      { status: 500 }
    )
  }
}
