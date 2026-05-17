import JSZip from 'jszip'
import { format } from 'date-fns'
import { generateReportHTML } from '@/lib/reportExportHtml'

const sanitizeSegment = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()

/** Reports must include user { name }, customer { name }, entries ordered */
export async function buildTimeReportsZipBuffer(reports: any[]): Promise<{
  buffer: Buffer
  suggestedFilename: string
}> {
  const zip = new JSZip()
  const usedNames = new Set<string>()
  const sorted = [...reports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  for (const report of sorted) {
    const reportDate = format(new Date(report.date), 'yyyy-MM-dd')
    const base = `tidrapport-${sanitizeSegment(report.user.name)}-${sanitizeSegment(
      report.customer.name
    )}-${reportDate}`
    let fileName = `${base}.html`
    let n = 1
    while (usedNames.has(fileName)) {
      fileName = `${base}-${++n}.html`
    }
    usedNames.add(fileName)
    zip.file(fileName, generateReportHTML(report))
  }

  const zipAb = await zip.generateAsync({ type: 'arraybuffer' })
  const buffer = Buffer.from(zipAb)

  const firstCustomer = sorted[0]?.customer?.name ?? 'rapporter'
  const stamp = format(new Date(), 'yyyy-MM-dd')
  const suggestedFilename = `tidrapporter-${sanitizeSegment(firstCustomer)}-${stamp}.zip`

  return { buffer, suggestedFilename }
}
