import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

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
    const month = searchParams.get('month')
    const exportFormat = searchParams.get('format') || 'csv' // csv eller xml

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

    if (exportFormat === 'xml') {
      return generateXMLExport(reports)
    } else {
      return generateCSVExport(reports)
    }
  } catch (error: any) {
    console.error('Fel vid export av tidrapporter:', error)
    return NextResponse.json(
      { error: 'Kunde inte exportera tidrapporter' },
      { status: 500 }
    )
  }
}

function generateCSVExport(reports: any[]): NextResponse {
  // CSV-header
  const headers = [
    'Datum',
    'År',
    'Månad',
    'Anställd',
    'E-post',
    'Kund',
    'Beställarens referens',
    'Timmar',
    'Totaltid för kund',
    'Fordon',
    'Arbetsbeskrivning',
    'Plats',
    'Referensnummer',
  ]

  const rows: string[] = [headers.join(';')]

  // Lägg till varje rapport
  for (const report of reports) {
    const reportDate = format(new Date(report.date), 'yyyy-MM-dd')
    const monthName = format(new Date(report.date), 'MMMM', { locale: sv })

    if (report.entries && report.entries.length > 0) {
      // En rad per aktivitet
      for (const entry of report.entries) {
        const row = [
          reportDate,
          report.year.toString(),
          monthName,
          report.user.name,
          report.user.email,
          report.customer.name,
          report.buyerReference?.trim?.() ||
            report.buyerReference ||
            '',
          entry.hours.toString(),
          report.totalHours.toString(),
          entry.vehicle || '',
          entry.description,
          entry.location || '',
          entry.referenceNumber || '',
        ]
        rows.push(row.map(cell => `"${cell}"`).join(';'))
      }
    } else {
      // Om inga entries, lägg till en rad med totala timmar
      const row = [
        reportDate,
        report.year.toString(),
        monthName,
        report.user.name,
        report.user.email,
        report.customer.name,
        report.buyerReference?.trim?.() || report.buyerReference || '',
        report.totalHours.toString(),
        report.totalHours.toString(),
        '',
        'Inga detaljer',
        '',
        '',
      ]
      rows.push(row.map(cell => `"${cell}"`).join(';'))
    }
  }

  const csv = rows.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tidrapporter-lonesystem-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
    },
  })
}

function generateXMLExport(reports: any[]): NextResponse {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<TimeReports>\n'

  for (const report of reports) {
    const reportDate = format(new Date(report.date), 'yyyy-MM-dd')
    xml += '  <TimeReport>\n'
    xml += `    <Date>${reportDate}</Date>\n`
    xml += `    <Year>${report.year}</Year>\n`
    xml += `    <EmployeeName>${escapeXML(report.user.name)}</EmployeeName>\n`
    xml += `    <EmployeeEmail>${escapeXML(report.user.email)}</EmployeeEmail>\n`
    xml += `    <Customer>${escapeXML(report.customer.name)}</Customer>\n`
    xml += `    <BuyerReference>${escapeXML((report.buyerReference && String(report.buyerReference).trim()) || '')}</BuyerReference>\n`
    xml += `    <TotalHours>${report.totalHours}</TotalHours>\n`
    xml += `    <CustomerTotalHours>${report.totalHours}</CustomerTotalHours>\n`

    if (report.entries && report.entries.length > 0) {
      xml += '    <Entries>\n'
      for (const entry of report.entries) {
        xml += '      <Entry>\n'
        xml += `        <Hours>${entry.hours}</Hours>\n`
        xml += `        <Vehicle>${escapeXML(entry.vehicle || '')}</Vehicle>\n`
        xml += `        <Description>${escapeXML(entry.description)}</Description>\n`
        xml += `        <Location>${escapeXML(entry.location || '')}</Location>\n`
        xml += `        <ReferenceNumber>${escapeXML(entry.referenceNumber || '')}</ReferenceNumber>\n`
        xml += '      </Entry>\n'
      }
      xml += '    </Entries>\n'
    }

    xml += '  </TimeReport>\n'
  }

  xml += '</TimeReports>'

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="tidrapporter-lonesystem-${format(new Date(), 'yyyy-MM-dd')}.xml"`,
    },
  })
}

function escapeXML(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
