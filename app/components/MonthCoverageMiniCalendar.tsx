'use client'

import Link from 'next/link'
import type { DayCoverage } from '@/lib/monthDayCoverage'
import {
  formatCoverageDateSv,
  parseMonthKey,
  timeReportCreateHref,
} from '@/lib/monthDayCoverage'

const WEEKDAY_HEADERS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'] as const

export type MiniCalendarVariant = 'employee' | 'admin'

function employeeDayClass(day: DayCoverage): string {
  const isWeekend = day.weekday === 0 || day.weekday === 6
  const base =
    'aspect-square flex items-center justify-center rounded-md border text-sm font-medium transition-colors'

  if (day.hasTimeReport) {
    return `${base} bg-green-100 text-green-900 border-green-300 hover:bg-green-200`
  }
  if (isWeekend) {
    return `${base} bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100`
  }
  return `${base} bg-white text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-green-400`
}

function adminDayClass(day: DayCoverage): string {
  const isWeekend = day.weekday === 0 || day.weekday === 6
  const base =
    'aspect-square flex items-center justify-center rounded-md border text-xs font-medium transition-colors'

  if (isWeekend) {
    return `${base} bg-gray-50 text-gray-400 border-gray-100`
  }
  if (day.status === 'future') {
    return `${base} bg-gray-50/60 text-gray-300 border-gray-100`
  }
  if (day.hasDraft) {
    return `${base} bg-blue-50 text-blue-900 border-blue-200`
  }
  if (day.status === 'missing') {
    return `${base} bg-red-100 text-red-900 border-red-300 hover:bg-red-200`
  }
  if (day.status === 'partial') {
    return `${base} bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200`
  }
  if (day.hasTimeReport) {
    return `${base} bg-green-100 text-green-900 border-green-300`
  }
  return `${base} bg-white text-gray-700 border-gray-200`
}

type MonthCoverageMiniCalendarProps = {
  month: string
  days: DayCoverage[]
  variant?: MiniCalendarVariant
  forUserId?: string
  className?: string
}

export default function MonthCoverageMiniCalendar({
  month,
  days,
  variant = 'employee',
  forUserId,
  className = '',
}: MonthCoverageMiniCalendarProps) {
  const { year, monthIndex } = parseMonthKey(month)
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1
  const dayClass = variant === 'admin' ? adminDayClass : employeeDayClass

  return (
    <div className={`max-w-xs ${className}`}>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className={`text-center text-[10px] font-medium py-0.5 ${
              label === 'Lör' || label === 'Sön' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const className = dayClass(day)
          const title = formatCoverageDateSv(day.date)
          const href =
            variant === 'employee' || (variant === 'admin' && !day.hasDraft)
              ? timeReportCreateHref(day.date, forUserId)
              : null

          if (href && variant === 'employee') {
            return (
              <Link key={day.date} href={href} className={className} title={title}>
                {day.dayOfMonth}
              </Link>
            )
          }

          if (href && variant === 'admin' && day.status !== 'future') {
            return (
              <Link
                key={day.date}
                href={href}
                className={className}
                title={`${title} — öppna tidrapport`}
              >
                {day.dayOfMonth}
              </Link>
            )
          }

          return (
            <div key={day.date} className={className} title={title}>
              {day.dayOfMonth}
            </div>
          )
        })}
      </div>
    </div>
  )
}
