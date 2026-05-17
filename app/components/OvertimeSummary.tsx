import { formatOvertimeHours, STANDARD_DAY_HOURS } from '@/lib/overtime'

type Props = {
  overtimeHours: number
  className?: string
}

/** Visar övertid när dagens total överstiger 8 timmar. */
export default function OvertimeSummary({ overtimeHours, className = '' }: Props) {
  if (!Number.isFinite(overtimeHours) || overtimeHours <= 0) return null

  return (
    <div
      className={`mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm ${className}`}
      role="status"
    >
      <p className="font-semibold text-amber-900">
        {formatOvertimeHours(overtimeHours)} timmar övertid
      </p>
      <p className="mt-0.5 text-amber-800/90">
        All tid över {STANDARD_DAY_HOURS} timmar samma dag räknas som övertid (normal dag:{' '}
        {STANDARD_DAY_HOURS} h).
      </p>
    </div>
  )
}
