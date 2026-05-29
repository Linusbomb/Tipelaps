import {
  formatOvertimeHours,
  HOLIDAY_WORK_OVERTIME_LABEL,
  NORMAL_WORK_END,
  NORMAL_WORK_START,
  STANDARD_DAY_HOURS,
} from '@/lib/overtime'

type Props = {
  overtimeHours: number
  isHolidayWork?: boolean
  className?: string
}

/** Visar övertid enligt svensk arbetstidsregel. */
export default function OvertimeSummary({ overtimeHours, isHolidayWork = false, className = '' }: Props) {
  if (!Number.isFinite(overtimeHours) || overtimeHours <= 0) return null

  return (
    <div
      className={`mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm ${className}`}
      role="status"
    >
      <p className="font-semibold text-amber-900">
        {formatOvertimeHours(overtimeHours)} timmar övertid
        {isHolidayWork ? ` — ${HOLIDAY_WORK_OVERTIME_LABEL}` : ''}
      </p>
      <p className="mt-0.5 text-amber-800/90">
        {isHolidayWork
          ? 'Hela arbetstiden på helg eller röd dag räknas som övertid mot lön.'
          : `Övertid räknas för tid över ${STANDARD_DAY_HOURS} h per dag och arbetad tid utanför ${NORMAL_WORK_START}-${NORMAL_WORK_END}.`}
      </p>
    </div>
  )
}
