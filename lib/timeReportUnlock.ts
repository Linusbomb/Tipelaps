/** Status som admin kan återställa till utkast för komplettering. */
export const UNLOCKABLE_TIME_REPORT_STATUSES = ['SUBMITTED', 'APPROVED'] as const

export const UNLOCKABLE_ABSENCE_STATUSES = ['SUBMITTED', 'APPROVED'] as const

export const timeReportUnlockUpdate = {
  status: 'DRAFT',
  submittedAt: null,
  approvedAt: null,
  approvedBy: null,
} as const

export const absenceReportUnlockUpdate = {
  status: 'DRAFT',
  submittedAt: null,
  approvedAt: null,
  approvedBy: null,
} as const
