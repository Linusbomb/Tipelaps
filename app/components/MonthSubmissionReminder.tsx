'use client'

import Link from 'next/link'
import {
  MonthReminderKind,
  TIME_REPORT_SUBMIT_TAB_HREF,
  TIME_REPORT_SUBMIT_TAB_LABEL,
} from '@/lib/monthReporting'

type MonthSubmissionReminderProps = {
  message: string
  kind: MonthReminderKind
  /** Sätt till `null` för att dölja länken (t.ex. när användaren redan är på inlämningsfliken). */
  actionHref?: string | null
  actionLabel?: string
  className?: string
}

export default function MonthSubmissionReminder({
  message,
  kind,
  actionHref = TIME_REPORT_SUBMIT_TAB_HREF,
  actionLabel = TIME_REPORT_SUBMIT_TAB_LABEL,
  className = '',
}: MonthSubmissionReminderProps) {
  if (!message) return null

  const isUrgent = kind === 'month-end' || kind === 'previous-month'
  const border = isUrgent ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'
  const title = isUrgent ? 'Påminnelse: skicka in tidrapporter' : 'Komplettera tidigare månad'

  return (
    <div
      className={`mb-5 rounded-lg border p-4 ${border} ${className}`}
      role="status"
    >
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-700">{message}</p>
      <p className="mt-2 text-xs text-gray-600">
        Vanligtvis skickas tidrapporter in i slutet av varje månad. Du kan även skicka in
        retroaktivt för tidigare månader om det behövs.
      </p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-3 inline-block text-sm font-semibold text-green-800 underline underline-offset-2 hover:text-green-950"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
