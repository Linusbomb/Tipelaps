import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { computeOvertimeHours, formatOvertimeHours, resolveOvertimeHours } from '@/lib/overtime'

/** Report shape from Prisma include: user, customer, entries[] */
export function generateReportHTML(report: {
  date: Date | string
  year: number
  customerTotalHours?: number
  overtimeHours?: number | null
  missingHoursReason?: string | null
  buyerReference?: string | null
  totalHours?: number
  user: { name: string }
  customer: { name: string }
  entries: Array<{
    hours: number
    machineHours?: number | null
    vehicle?: string | null
    description?: string | null
    startTime?: string | null
    endTime?: string | null
    location?: string | null
    referenceNumber?: string | null
  }>
}): string {
  const reportDate = format(new Date(report.date), 'd MMMM yyyy', { locale: sv })
  const totalHours = report.totalHours ?? report.entries.reduce((sum, entry) => sum + entry.hours, 0)
  const billableHours = report.customerTotalHours ?? totalHours
  const overtimeHours = resolveOvertimeHours(report.overtimeHours, totalHours, report.entries)

  const entryBlocks = report.entries.map((entry, index) => {
    const mh =
      entry.machineHours != null && entry.machineHours > 0
        ? `
          <div class="entry-detail">
            <strong>Fordonstimmar:</strong> ${entry.machineHours} timmar
          </div>
        `
        : ''
    return `
      <div class="entry">
        <div class="entry-header">
          <span style="font-weight: bold; color: #666;">Aktivitet ${index + 1}</span>
          <span class="entry-hours">${entry.hours} timmar</span>
        </div>
        <div class="entry-details">
          <div class="entry-detail" style="grid-column: 1 / -1; margin-bottom: 10px;">
            <strong>Arbetsbeskrivning:</strong> ${entry.description || '-'}
          </div>
          ${mh}
          ${
            entry.vehicle
              ? `
          <div class="entry-detail">
            <strong>Fordon:</strong> ${entry.vehicle}
          </div>
          `
              : '<div class="entry-detail"></div>'
          }
          ${
            entry.location
              ? `
          <div class="entry-detail">
            <strong>Plats:</strong> ${entry.location}
          </div>
          `
              : '<div class="entry-detail"></div>'
          }
          ${
            entry.referenceNumber
              ? `
          <div class="entry-detail" style="grid-column: 1 / -1;">
            <strong>Referensnummer:</strong> ${entry.referenceNumber}
          </div>
          `
              : ''
          }
        </div>
      </div>
    `
  })

  const buyerRefRow =
    report.buyerReference && String(report.buyerReference).trim()
      ? `
    <div class="info-box" style="grid-column: 1 / -1;">
      <label>Beställarens referens</label>
      <div class="value">${String(report.buyerReference).trim()}</div>
    </div>`
      : ''

  const overtimeRow =
    overtimeHours > 0
      ? `
    <div class="summary-row" style="color: #b45309;">
      <span><strong>Övertid (över 8 h eller utanför 07:00-16:00):</strong></span>
      <span>${formatOvertimeHours(overtimeHours)} timmar</span>
    </div>`
      : ''

  const reasonRow =
    report.missingHoursReason && report.missingHoursReason.trim()
      ? `
    <div class="summary-row" style="flex-direction: column; align-items: flex-start;">
      <span><strong>Justering/komplettering (${report.customer.name}):</strong></span>
      <span style="margin-top: 8px; white-space: pre-wrap;">${report.missingHoursReason}</span>
    </div>`
      : ''

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tidrapport - ${report.customer.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #333;
      background: #fff;
    }
    .header {
      border-bottom: 3px solid #0ea5e9;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { color: #0ea5e9; font-size: 28px; margin-bottom: 10px; }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
    }
    .info-box label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      display: block;
      margin-bottom: 5px;
    }
    .info-box .value { font-size: 16px; color: #333; }
    .entries-section { margin-bottom: 30px; }
    .entries-section h2 {
      color: #0ea5e9;
      font-size: 20px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .entry {
      background: #f8f9fa;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 5px;
      border-left: 4px solid #0ea5e9;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .entry-hours { font-size: 18px; font-weight: bold; color: #0ea5e9; }
    .entry-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 14px;
    }
    .entry-detail { margin-bottom: 8px; }
    .entry-detail strong { color: #666; margin-right: 5px; }
    .summary {
      background: #e0f2fe;
      padding: 20px;
      border-radius: 5px;
      margin-top: 30px;
    }
    .summary h2 { color: #0ea5e9; font-size: 20px; margin-bottom: 15px; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #bae6fd;
    }
    .summary-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 18px;
      color: #0ea5e9;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Tidrapport</h1>
    <p style="color: #666; font-size: 14px;">Redovisning av debiterbar tid</p>
  </div>
  <div class="info-section">
    <div class="info-box">
      <label>Kund</label>
      <div class="value">${report.customer.name}</div>
    </div>
    <div class="info-box">
      <label>Datum</label>
      <div class="value">${reportDate}</div>
    </div>
    <div class="info-box">
      <label>År</label>
      <div class="value">${report.year}</div>
    </div>
    <div class="info-box">
      <label>Anställd</label>
      <div class="value">${report.user.name}</div>
    </div>
    ${buyerRefRow}
  </div>
  <div class="entries-section">
    <h2>Arbetsdetaljer</h2>
    ${entryBlocks.join('\n')}
  </div>
  <div class="summary">
    <h2>Sammanfattning</h2>
    <div class="summary-row">
      <span>Arbetad tid (lönetid):</span>
      <span>${totalHours.toFixed(1)} timmar</span>
    </div>
    <div class="summary-row">
      <span>Debiterbar tid för ${report.customer.name}:</span>
      <span>${billableHours.toFixed(1)} timmar</span>
    </div>
    ${overtimeRow}
    ${reasonRow}
  </div>
  <div class="footer">
    <p>Detta är en automatgenererad tidrapport från tidrapporteringssystemet</p>
    <p>Genererad: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: sv })}</p>
  </div>
</body>
</html>`
}
