/** Filtervärde på Mina rapporter: alla utom utkast. */
export const MY_REPORTS_STATUS_ALL_FILED = 'ALL_FILED'

/** Inlämnad till admin (väntar eller godkänd). */
export function isFiledReportStatus(status: string): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

export function isDraftReportStatus(status: string): boolean {
  return status === 'DRAFT'
}
