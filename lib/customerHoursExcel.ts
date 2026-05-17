import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { resolveOvertimeHours } from '@/lib/overtime'

export type CustomerHoursReport = {
  id: string
  date: Date
  year: number
  month: string
  status: string
  totalHours: number
  customerTotalHours: number
  overtimeHours?: number | null
  buyerReference?: string | null
  user: { name: string; email: string }
  customer: { name: string }
  entries: Array<{
    hours: number
    machineHours: number | null
    vehicle: string | null
    description: string
    location: string | null
    referenceNumber: string | null
  }>
}

const STATUS_SV: Record<string, string> = {
  SUBMITTED: 'Inlämnad',
  APPROVED: 'Godkänd',
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^\w\såäöÅÄÖ-]/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'kund'
}

export function buildCustomerHoursExcelBuffer(
  reports: CustomerHoursReport[],
  options: { customerName: string; monthLabel?: string }
): { buffer: Buffer; filename: string } {
  const detailHeaders = [
    'Datum',
    'Månad (YYYY-MM)',
    'Personal',
    'E-post',
    'Kund',
    'Status',
    'Beställarens referens',
    'Timmar (aktivitet)',
    'Fordonstimmar',
    'Timmar rapport totalt',
    'Övertid (h)',
    'Fakturerbar tid kund',
    'Fordon',
    'Arbetsbeskrivning',
    'Plats',
    'Referensnummer',
  ]

  const detailRows: (string | number)[][] = [detailHeaders]

  for (const report of reports) {
    const reportDate = format(new Date(report.date), 'yyyy-MM-dd')
    const statusLabel = STATUS_SV[report.status] ?? report.status
    const buyerRef = report.buyerReference?.trim() ?? ''
    const overtime = resolveOvertimeHours(report.overtimeHours, report.totalHours)

    if (report.entries.length > 0) {
      for (const entry of report.entries) {
        detailRows.push([
          reportDate,
          report.month,
          report.user.name,
          report.user.email,
          report.customer.name,
          statusLabel,
          buyerRef,
          entry.hours,
          entry.machineHours ?? '',
          report.totalHours,
          overtime > 0 ? overtime : '',
          report.customerTotalHours,
          entry.vehicle ?? '',
          entry.description,
          entry.location ?? '',
          entry.referenceNumber ?? '',
        ])
      }
    } else {
      detailRows.push([
        reportDate,
        report.month,
        report.user.name,
        report.user.email,
        report.customer.name,
        statusLabel,
        buyerRef,
        report.totalHours,
        '',
        report.totalHours,
        overtime > 0 ? overtime : '',
        report.customerTotalHours,
        '',
        'Inga aktivitetsrader',
        '',
        '',
      ])
    }
  }

  const summaryMap = new Map<
    string,
    { name: string; email: string; reportCount: number; hours: number; overtime: number }
  >()
  for (const report of reports) {
    const key = report.user.email
    const prev = summaryMap.get(key) ?? {
      name: report.user.name,
      email: report.user.email,
      reportCount: 0,
      hours: 0,
      overtime: 0,
    }
    prev.reportCount += 1
    prev.hours += report.customerTotalHours ?? report.totalHours
    prev.overtime += resolveOvertimeHours(report.overtimeHours, report.totalHours)
    summaryMap.set(key, prev)
  }

  const summaryRows: (string | number)[][] = [
    ['Personal', 'E-post', 'Antal tidrapporter', 'Timmar totalt (fakturerbart)', 'Övertid totalt (h)'],
    ...Array.from(summaryMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
      .map((row) => [
        row.name,
        row.email,
        row.reportCount,
        Math.round(row.hours * 100) / 100,
        Math.round(row.overtime * 100) / 100,
      ]),
  ]

  const totalHours = reports.reduce(
    (sum, r) => sum + (r.customerTotalHours ?? r.totalHours),
    0
  )
  const totalOvertime = reports.reduce(
    (sum, r) => sum + resolveOvertimeHours(r.overtimeHours, r.totalHours),
    0
  )
  summaryRows.push([])
  summaryRows.push(['Totalt antal tidrapporter', reports.length])
  summaryRows.push(['Timmar totalt', Math.round(totalHours * 100) / 100])
  summaryRows.push(['Övertid totalt', Math.round(totalOvertime * 100) / 100])

  const wb = XLSX.utils.book_new()
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)

  wsDetail['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 36 },
    { wch: 18 },
    { wch: 16 },
  ]

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Tidrapporter')
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sammanfattning')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const customerPart = safeFilenamePart(options.customerName)
  const monthPart = options.monthLabel
    ? safeFilenamePart(options.monthLabel)
    : 'alla-manader'
  const filename = `tidrapporter-${customerPart}-${monthPart}.xlsx`

  return { buffer, filename }
}

export function monthLabelFromKey(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey
  const raw = format(new Date(`${monthKey}-01T12:00:00`), 'MMMM-yyyy', { locale: sv })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
