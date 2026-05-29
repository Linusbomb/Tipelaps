/** Filtervärde på Mina rapporter: alla utom utkast. */
export const MY_REPORTS_STATUS_ALL_FILED = 'ALL_FILED'

/** Inlämnad till admin (väntar eller godkänd). */
export function isFiledReportStatus(status: string): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

export function isDraftReportStatus(status: string): boolean {
  return status === 'DRAFT'
}

export function isSubmittedReportStatus(status: string): boolean {
  return status === 'SUBMITTED'
}

export function isApprovedReportStatus(status: string): boolean {
  return status === 'APPROVED'
}

/** Rapport inskickad eller godkänd — skrivskyddad för personal. */
export function isLockedReportStatus(status: string): boolean {
  return isSubmittedReportStatus(status) || isApprovedReportStatus(status)
}

export function lockedReportStatusHint(status: string): string {
  if (isApprovedReportStatus(status)) {
    return 'Godkänd av admin. Be din admin låsa upp om något behöver rättas.'
  }
  if (isSubmittedReportStatus(status)) {
    return 'Inskickad och låst. Be din admin låsa upp om du behöver ändra.'
  }
  return ''
}
