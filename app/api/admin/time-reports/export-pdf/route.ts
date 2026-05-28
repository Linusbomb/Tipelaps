import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { resolveOvertimeHours } from '@/lib/overtime'

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
    const monthFilter = searchParams.get('month')

    const where: any = {
      user: {
        companyId: user.companyId,
      },
      status: 'APPROVED', // Endast godkända rapporter
    }

    if (monthFilter) {
      where.month = monthFilter
    }

    const reports = await prisma.timeReport.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            companyId: true,
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
      return NextResponse.json({ error: 'Inga godkända tidrapporter hittades för vald månad.' }, { status: 404 })
    }

    // Skapa PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    let yPosition = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7

    // Lägg till titel
    doc.setFontSize(18)
    doc.text('Godkända Tidrapporter', margin, yPosition)
    yPosition += 10

    if (monthFilter) {
      const monthName = format(new Date(monthFilter + '-01'), 'MMMM yyyy', { locale: sv })
      doc.setFontSize(12)
      doc.text(`Månad: ${monthName}`, margin, yPosition)
      yPosition += 8
    }

    // Gruppera rapporter per anställd
    const reportsByEmployee: { [key: string]: any[] } = {}
    reports.forEach((report) => {
      const employeeId = report.user.id
      if (!reportsByEmployee[employeeId]) {
        reportsByEmployee[employeeId] = []
      }
      reportsByEmployee[employeeId].push(report)
    })

    // Lägg till varje anställds rapporter
    Object.entries(reportsByEmployee).forEach(([employeeId, employeeReports]) => {
      const employee = employeeReports[0].user

      // Kontrollera om vi behöver ny sida
      if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
      }

      // Anställdens namn
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(employee.name, margin, yPosition)
      yPosition += 8

      // Lägg till varje rapport för denna anställd
      employeeReports.forEach((report) => {
        // Kontrollera om vi behöver ny sida
        if (yPosition > pageHeight - 80) {
          doc.addPage()
          yPosition = 20
        }

        const reportDate = format(new Date(report.date), 'd MMMM yyyy', { locale: sv })
        const totalHours = report.entries.reduce((sum: number, entry: any) => sum + entry.hours, 0)
        const billableHours = report.customerTotalHours ?? totalHours
        const totalMachineHoursPdf = report.entries.reduce(
          (sum: number, entry: any) =>
            sum + (entry.machineHours && entry.machineHours > 0 ? entry.machineHours : 0),
          0
        )
        const otherNonMachineHours = Math.max(0, totalHours - totalMachineHoursPdf)

        // Rapportinformation
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Datum: ${reportDate}`, margin, yPosition)
        yPosition += lineHeight
        doc.text(`Kund: ${report.customer?.name || 'Okänd'}`, margin, yPosition)
        yPosition += lineHeight
        if (report.buyerReference && String(report.buyerReference).trim()) {
          doc.text(`Beställarens ref: ${String(report.buyerReference).trim()}`, margin, yPosition)
          yPosition += lineHeight
        }
        doc.text(`Lönetid: ${totalHours.toFixed(1)}h`, margin, yPosition)
        yPosition += lineHeight
        doc.text(`Debiterbar tid kund: ${billableHours.toFixed(1)}h`, margin, yPosition)
        yPosition += lineHeight

        const overtimeHours = resolveOvertimeHours(report.overtimeHours, totalHours, report.entries)
        if (overtimeHours > 0) {
          doc.text(`Övertid (över 8 h/utanför 07-16): ${overtimeHours.toFixed(1)}h`, margin, yPosition)
          yPosition += lineHeight
        }

        if (otherNonMachineHours > 0) {
          doc.text(`Övrig tid (ej fordonstimmar): ${otherNonMachineHours.toFixed(1)}h`, margin, yPosition)
          yPosition += lineHeight
          if (report.missingHoursReason) {
            doc.text(`Förklaring: ${report.missingHoursReason}`, margin, yPosition)
            yPosition += lineHeight
          }
        }

        // Tabell för aktiviteter
        const tableData = report.entries.map((entry: any) => [
          entry.hours.toFixed(1) + 'h',
          entry.description || '-',
          entry.vehicle || '-',
          entry.location || '-',
          entry.referenceNumber || '-',
        ])

        autoTable(doc, {
          startY: yPosition,
          head: [['Timmar', 'Beskrivning', 'Fordon', 'Plats', 'Referens']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [45, 80, 22], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        })

        yPosition = (doc as any).lastAutoTable.finalY + 10

        // Avstånd mellan rapporter
        yPosition += 5
      })

      // Avstånd mellan anställda
      yPosition += 10
    })

    // Generera PDF som buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    const monthSuffix = monthFilter ? `-${monthFilter}` : '-alla'
    const filename = `godkanda-tidrapporter${monthSuffix}-${format(new Date(), 'yyyy-MM-dd')}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Fel vid export av tidrapporter till PDF:', error)
    return NextResponse.json(
      { error: 'Kunde inte exportera tidrapporter till PDF' },
      { status: 500 }
    )
  }
}
