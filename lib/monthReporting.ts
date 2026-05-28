/** Hjälpfunktioner för månadsvis tidrapportering och påminnelser. */

/** Direktlänk till fliken «Tidrapporter & inlämning» på tidrapportssidan. */
export const TIME_REPORT_SUBMIT_TAB_HREF = '/time-report?tab=submit'
export const TIME_REPORT_SUBMIT_TAB_LABEL = 'Gå till tidrapporter & inlämning'

export function formatMonthYearSv(monthKey: string) {
  const raw = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('sv-SE', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function buildMonthOptions(count: number, minYear = 2026) {
  const options: string[] = []
  const now = new Date()
  const baseDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const minAllowedDate = new Date(minYear, 0, 1)

  for (let i = 0; i < count; i += 1) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1)
    if (d < minAllowedDate) break
    options.push(toMonthKey(d))
  }

  return options
}

export function getPreviousMonthKey(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() - 1, 1)
  return toMonthKey(d)
}

export function isPastMonth(monthKey: string, now = new Date()) {
  return monthKey < toMonthKey(now)
}

export function isCurrentMonth(monthKey: string, now = new Date()) {
  return monthKey === toMonthKey(now)
}

/** Sista dagarna i månaden – då ska rapporter skickas in. */
export function isNearMonthEnd(now = new Date(), daysBeforeEnd = 5) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return now.getDate() >= lastDay - daysBeforeEnd + 1
}

/** Första dagarna i ny månad – påminn om föregående månads utkast. */
export function isEarlyInMonth(now = new Date(), daysAfterStart = 7) {
  return now.getDate() <= daysAfterStart
}

export function dateInputBounds(monthsBack = 24) {
  const now = new Date()
  const max = now.toISOString().split('T')[0]
  const minDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const min = minDate.toISOString().split('T')[0]
  return { min, max }
}

export type MonthReminderKind = 'month-end' | 'previous-month' | 'past-month-drafts' | null

export function resolveMonthReminder(opts: {
  now?: Date
  viewMonth: string
  draftCountCurrentMonth: number
  draftCountPreviousMonth: number
}): { kind: MonthReminderKind; message: string } | null {
  const now = opts.now ?? new Date()
  const currentMonth = toMonthKey(now)
  const previousMonth = getPreviousMonthKey(now)

  if (isPastMonth(opts.viewMonth, now) && opts.draftCountCurrentMonth > 0) {
    return {
      kind: 'past-month-drafts',
      message: `Du har ${opts.draftCountCurrentMonth} utkast för ${formatMonthYearSv(opts.viewMonth)} som kan skickas in till admin retroaktivt.`,
    }
  }

  if (isCurrentMonth(opts.viewMonth, now) && isNearMonthEnd(now) && opts.draftCountCurrentMonth > 0) {
    return {
      kind: 'month-end',
      message: `Månadsskiftet närmar sig. Du har ${opts.draftCountCurrentMonth} utkast för ${formatMonthYearSv(currentMonth)} – skicka in till admin innan månaden är slut.`,
    }
  }

  if (
    isEarlyInMonth(now) &&
    opts.viewMonth === previousMonth &&
    opts.draftCountCurrentMonth > 0
  ) {
    return {
      kind: 'previous-month',
      message: `Du har ${opts.draftCountCurrentMonth} utkast kvar från ${formatMonthYearSv(previousMonth)}. Skicka in till admin så snart som möjligt.`,
    }
  }

  if (
    isEarlyInMonth(now) &&
    opts.viewMonth === currentMonth &&
    opts.draftCountPreviousMonth > 0
  ) {
    return {
      kind: 'previous-month',
      message: `Glöm inte ${formatMonthYearSv(previousMonth)}: du har ${opts.draftCountPreviousMonth} utkast som ännu inte skickats till admin.`,
    }
  }

  return null
}
