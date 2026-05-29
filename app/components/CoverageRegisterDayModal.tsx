'use client'

import Link from 'next/link'
import {
  absenceCreateHref,
  formatCoverageDateSv,
  timeReportCreateHref,
} from '@/lib/monthDayCoverage'

type CoverageRegisterDayModalProps = {
  open: boolean
  dateKey: string
  forUserId?: string
  onClose: () => void
}

export default function CoverageRegisterDayModal({
  open,
  dateKey,
  forUserId,
  onClose,
}: CoverageRegisterDayModalProps) {
  if (!open) return null

  const timeHref = timeReportCreateHref(dateKey, forUserId)
  const absenceHref = absenceCreateHref(dateKey, forUserId)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coverage-register-day-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="coverage-register-day-title" className="text-lg font-semibold text-gray-900 mb-1">
          {formatCoverageDateSv(dateKey)}
        </h2>
        <p className="text-sm text-gray-600 mb-5">Inget registrerat denna dag. Vad vill du göra?</p>

        <div className="flex flex-col gap-2">
          <Link
            href={timeHref}
            className="rounded-lg py-2.5 px-4 text-sm font-semibold text-white text-center transition hover:opacity-90"
            style={{ backgroundColor: '#2D5016' }}
            onClick={onClose}
          >
            Registrera tidrapport
          </Link>
          <Link
            href={absenceHref}
            className="rounded-lg py-2.5 px-4 text-sm font-semibold text-center border border-violet-400 text-violet-950 bg-violet-50 hover:bg-violet-100 transition"
            onClick={onClose}
          >
            Registrera frånvaro
          </Link>
          <button
            type="button"
            className="rounded-lg py-2.5 px-4 text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition mt-1"
            onClick={onClose}
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}
