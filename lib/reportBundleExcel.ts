import JSZip from 'jszip'
import { format } from 'date-fns'

export type ExcelTimeReport = {
  id: string
  date: Date | string
  year: number
  month: string
  status: string
  submittedAt?: Date | string | null
  approvedAt?: Date | string | null
  totalHours?: number | null
  customerTotalHours?: number | null
  buyerReference?: string | null
  missingHoursReason?: string | null
  user: { id?: string; name: string }
  customer: { id?: string; name: string }
  entries: Array<{
    hours: number
    machineHours?: number | null
    vehicle?: string | null
    description?: string | null
    location?: string | null
    referenceNumber?: string | null
  }>
}

const sanitizeSegment = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()

const STATUS_SV: Record<string, string> = {
  DRAFT: 'Utkast',
  SUBMITTED: 'Inlämnad',
  APPROVED: 'Godkänd',
}

const COLUMNS = [
  'Datum',
  'År',
  'Månad',
  'Anställd',
  'Kund',
  'Beställarens referens',
  'Aktivitet #',
  'Timmar',
  'Fordonstimmar',
  'Fordon',
  'Arbetsbeskrivning',
  'Plats',
  'Referensnummer',
  'Total tid (rapport)',
  'Fakturerbar tid (kund)',
  'Förklaring resterande tid',
  'Status',
  'Inskickad',
  'Godkänd',
] as const

const SUMMARY_COLUMNS = [
  'Datum',
  'Månad',
  'Anställd',
  'Kund',
  'Beställarens referens',
  'Antal aktiviteter',
  'Total tid (h)',
  'Fordonstimmar (h)',
  'Fakturerbar tid (h)',
  'Status',
] as const

function toExcelDateString(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'yyyy-MM-dd')
}

function toExcelDateTimeString(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'yyyy-MM-dd HH:mm')
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cellRef(row: number, col: number): string {
  let n = col
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return `${letters}${row}`
}

function isNumberCell(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function estimateColumnWidth(rows: unknown[][], colIndex: number): number {
  const maxLength = rows.reduce((max, row) => {
    const value = row[colIndex]
    const length = String(value ?? '').length
    return Math.max(max, length)
  }, 0)

  return Math.min(Math.max(maxLength + 2, 8), 60)
}

function makeColsXml(rows: unknown[][]): string {
  const maxCol = Math.max(...rows.map((r) => r.length), 1)
  const cols = Array.from({ length: maxCol }, (_, index) => {
    const col = index + 1
    const width = estimateColumnWidth(rows, index)
    return `<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`
  }).join('')

  return `<cols>${cols}</cols>`
}

function makeSheetXml(rows: unknown[][]): string {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const r = rowIndex + 1
      const cells = row
        .map((value, colIndex) => {
          const ref = cellRef(r, colIndex + 1)
          if (isNumberCell(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
        })
        .join('')
      return `<row r="${r}">${cells}</row>`
    })
    .join('')

  const maxCol = Math.max(...rows.map((r) => r.length), 1)
  const maxRow = Math.max(rows.length, 1)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${cellRef(maxRow, maxCol)}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  ${makeColsXml(rows)}
  <sheetData>${sheetRows}</sheetData>
</worksheet>`
}

function makeWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sammanfattning" sheetId="1" r:id="rId1"/>
    <sheet name="Tidrapporter" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
}

function addXlsxStructure(zip: JSZip, summaryRows: unknown[][], reportRows: unknown[][]) {
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  )
  zip.file('xl/workbook.xml', makeWorkbookXml())
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`
  )
  zip.file('xl/worksheets/sheet1.xml', makeSheetXml(summaryRows))
  zip.file('xl/worksheets/sheet2.xml', makeSheetXml(reportRows))
}

/**
 * Bygger en .xlsx-buffer med:
 *  - "Tidrapporter": en rad per aktivitet (TimeReportEntry), med rapport-fält upprepade.
 *  - "Sammanfattning": en rad per tidrapport.
 * Rubrikerna matchar tidrapportsformulärets svenska etiketter.
 */
export async function buildTimeReportsXlsxBuffer(reports: ExcelTimeReport[]): Promise<{
  buffer: Buffer
  suggestedFilename: string
}> {
  const sorted = [...reports].sort((a, b) => {
    const ad = new Date(a.date).getTime()
    const bd = new Date(b.date).getTime()
    if (ad !== bd) return ad - bd
    return a.user.name.localeCompare(b.user.name, 'sv')
  })

  const summaryRows: unknown[][] = [Array.from(SUMMARY_COLUMNS)]
  const grandWorkedHours = sorted.reduce((sum, report) => {
    const entryHours = report.entries.reduce((s, entry) => s + (entry.hours || 0), 0)
    return sum + (report.totalHours ?? entryHours)
  }, 0)

  for (const r of sorted) {
    const totalEntryHours = r.entries.reduce((s, e) => s + (e.hours || 0), 0)
    const totalMachineHours = r.entries.reduce((s, e) => s + (e.machineHours || 0), 0)
    summaryRows.push([
      toExcelDateString(r.date),
      r.month,
      r.user.name,
      r.customer.name,
      r.buyerReference || '',
      r.entries.length,
      r.totalHours ?? totalEntryHours,
      totalMachineHours,
      r.customerTotalHours ?? totalEntryHours,
      STATUS_SV[r.status] ?? r.status,
    ])
  }
  summaryRows.push([])
  summaryRows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'Totalt antal arbetade timmar',
    '',
    grandWorkedHours,
    '',
  ])

  const reportRows: unknown[][] = [Array.from(COLUMNS)]

  for (const r of sorted) {
    const reportTotal =
      r.totalHours ?? r.entries.reduce((s, e) => s + (e.hours || 0), 0)
    const reportCustomerTotal =
      r.customerTotalHours ?? r.entries.reduce((s, e) => s + (e.hours || 0), 0)

    if (r.entries.length === 0) {
      reportRows.push([
        toExcelDateString(r.date),
        r.year,
        r.month,
        r.user.name,
        r.customer.name,
        r.buyerReference || '',
        '',
        '',
        '',
        '',
        '(Inga aktiviteter)',
        '',
        '',
        reportTotal,
        reportCustomerTotal,
        r.missingHoursReason || '',
        STATUS_SV[r.status] ?? r.status,
        toExcelDateTimeString(r.submittedAt),
        toExcelDateTimeString(r.approvedAt),
      ])
      continue
    }

    r.entries.forEach((e, idx) => {
      reportRows.push([
        toExcelDateString(r.date),
        r.year,
        r.month,
        r.user.name,
        r.customer.name,
        r.buyerReference || '',
        idx + 1,
        e.hours,
        e.machineHours ?? '',
        e.vehicle || '',
        e.description || '',
        e.location || '',
        e.referenceNumber || '',
        idx === 0 ? reportTotal : '',
        idx === 0 ? reportCustomerTotal : '',
        idx === 0 ? r.missingHoursReason || '' : '',
        idx === 0 ? STATUS_SV[r.status] ?? r.status : '',
        idx === 0 ? toExcelDateTimeString(r.submittedAt) : '',
        idx === 0 ? toExcelDateTimeString(r.approvedAt) : '',
      ])
    })
  }
  reportRows.push([])
  reportRows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'Totalt antal arbetade timmar',
    '',
    grandWorkedHours,
    '',
    '',
    '',
    '',
  ])

  const zip = new JSZip()
  addXlsxStructure(zip, summaryRows, reportRows)
  const ab = await zip.generateAsync({ type: 'arraybuffer' })
  const buffer = Buffer.from(ab)

  const firstCustomer = sorted[0]?.customer?.name ?? 'rapporter'
  const stamp = format(new Date(), 'yyyy-MM-dd')
  const suggestedFilename = `tidrapporter-${sanitizeSegment(firstCustomer)}-${stamp}.xlsx`

  return { buffer, suggestedFilename }
}

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
