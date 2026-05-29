'use client'

import Link from 'next/link'
import {
  monthReportStatusBadgeClass,
  monthReportStatusLabel,
} from '@/app/components/MonthCustomerReportFolders'
import {
  absenceHoursForPayroll,
  absenceScopeLabel,
  absenceTypeLabel,
} from '@/lib/absence'
import {
  absenceCreateHref,
  formatCoverageDateSv,
  timeReportCreateHref,
} from '@/lib/monthDayCoverage'
import type { CoverageMonthAbsence, CoverageMonthTimeReport } from '@/lib/monthCoverageRegistrations'
import {
  isApprovedReportStatus,
  isDraftReportStatus,
  isLockedReportStatus,
  lockedReportStatusHint,
} from '@/lib/reportStatus'

type CoverageDayDetailModalProps = {
  open: boolean
  dateKey: string
  timeReports: CoverageMonthTimeReport[]
  absences: CoverageMonthAbsence[]
  forUserId?: string
  adminView?: boolean
  subjectName?: string
  onClose: () => void
}

function ReportActions({
  complementHref,
  viewHref,
  status,
  complementLabel,
  viewLabel,
  adminView,
  onClose,
}: {
  complementHref: string
  viewHref?: string | null
  status: string
  complementLabel: string
  viewLabel: string
  adminView: boolean
  onClose: () => void
}) {
  const isDraft = isDraftReportStatus(status)
  const isLocked = isLockedReportStatus(status)
  const isApproved = isApprovedReportStatus(status)

  if (isDraft) {
    return (
      <Link
        href={complementHref}
        className="rounded-md px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: '#2D5016' }}
        onClick={onClose}
      >
        {complementLabel}
      </Link>
    )
  }

  if (isLocked) {
    const viewButtonClass =
      'rounded-md px-3 py-1.5 text-sm font-semibold border border-gray-400 text-gray-800 bg-white'

    return (
      <div className="flex flex-col items-start gap-1.5 w-full">
        <div className="flex flex-wrap items-center gap-2">
          {viewHref ? (
            <Link
              href={viewHref}
              className={`${viewButtonClass} hover:bg-gray-50 transition`}
              onClick={onClose}
            >
              {viewLabel}
            </Link>
          ) : (
            <span className={viewButtonClass}>{viewLabel}</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
            <span aria-hidden>🔒</span> Låst
          </span>
        </div>
        {!adminView ? (
          <p className="text-xs text-gray-600 max-w-[260px]">{lockedReportStatusHint(status)}</p>
        ) : null}
        {isApproved ? (
          <p className="text-xs font-semibold text-green-800">Godkänd av administratör</p>
        ) : null}
      </div>
    )
  }

  return null
}

export default function CoverageDayDetailModal({
  open,
  dateKey,
  timeReports,
  absences,
  forUserId,
  adminView = false,
  subjectName,
  onClose,
}: CoverageDayDetailModalProps) {
  if (!open) return null

  const timeReportCreateLink = timeReportCreateHref(dateKey, forUserId)
  const absenceCreateLink = absenceCreateHref(dateKey, forUserId)
  const reportDetailHref = (id: string) =>
    adminView ? `/admin/time-reports/${id}` : `/time-report/${id}`

  const totalTimeHours = timeReports.reduce(
    (sum, report) => sum + (Number(report.totalHours) || 0),
    0
  )
  const totalAbsenceHours = absences.reduce(
    (sum, absence) => sum + absenceHoursForPayroll(absence.isFullDay, absence.hours),
    0
  )

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coverage-day-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl p-6 max-h-[min(90vh,32rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="coverage-day-detail-title" className="text-lg font-semibold text-gray-900 mb-1">
          {formatCoverageDateSv(dateKey)}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {subjectName ? `Registrerat för ${subjectName}` : 'Registrerat på denna dag'}
        </p>

        {timeReports.length === 0 && absences.length === 0 ? (
          <p className="text-sm text-gray-600 mb-4">Inget registrerat hittades.</p>
        ) : (
          <div className="space-y-4 mb-5">
            {timeReports.length > 0 ? (
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tidrapporter
                  </h3>
                  {timeReports.length > 1 ? (
                    <span className="text-xs text-gray-600 tabular-nums">
                      Totalt {totalTimeHours.toFixed(1)} h
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-3">
                  {timeReports.map((report) => {
                    const hours = Number(report.totalHours ?? 0)
                    const isLocked = isLockedReportStatus(report.status)

                    return (
                      <li
                        key={report.id}
                        className={`rounded-lg border px-3 py-3 text-sm ${
                          isLocked
                            ? 'border-gray-300 bg-gray-50/90'
                            : 'border-green-200 bg-green-50/80'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-gray-900">{report.customer.name}</p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-semibold ${monthReportStatusBadgeClass(report.status)}`}
                          >
                            {monthReportStatusLabel(report.status)}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none mb-3">
                          {hours.toFixed(1)}{' '}
                          <span className="text-base font-semibold">timmar</span>
                        </p>
                        <ReportActions
                          complementHref={reportDetailHref(report.id)}
                          viewHref={reportDetailHref(report.id)}
                          status={report.status}
                          complementLabel="Komplettera"
                          viewLabel="Visa tidrapport"
                          adminView={adminView}
                          onClose={onClose}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {absences.length > 0 ? (
              <section>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Frånvaro
                  </h3>
                  {absences.length > 1 ? (
                    <span className="text-xs text-gray-600 tabular-nums">
                      Totalt {totalAbsenceHours.toFixed(1)} h
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-3">
                  {absences.map((absence) => {
                    const hours = absenceHoursForPayroll(absence.isFullDay, absence.hours)
                    const isLocked = isLockedReportStatus(absence.status)

                    return (
                      <li
                        key={absence.id}
                        className={`rounded-lg border px-3 py-3 text-sm ${
                          isLocked
                            ? 'border-gray-300 bg-gray-50/90'
                            : 'border-violet-300 bg-violet-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-violet-950">
                            {absenceTypeLabel(absence.type)}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-semibold ${monthReportStatusBadgeClass(absence.status)}`}
                          >
                            {monthReportStatusLabel(absence.status)}
                          </span>
                        </div>
                        <p className="text-sm text-violet-900 mb-1">
                          {absenceScopeLabel(absence.isFullDay, absence.hours)}
                        </p>
                        <p className="text-2xl font-bold text-violet-950 tabular-nums leading-none mb-2">
                          {hours.toFixed(1)}{' '}
                          <span className="text-base font-semibold">timmar</span>
                        </p>
                        {absence.note?.trim() ? (
                          <p className="text-violet-800 text-xs mb-3">{absence.note.trim()}</p>
                        ) : null}
                        <ReportActions
                          complementHref={absenceCreateLink}
                          viewHref={null}
                          status={absence.status}
                          complementLabel="Komplettera"
                          viewLabel="Visa frånvaro"
                          adminView={adminView}
                          onClose={onClose}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg py-2.5 px-4 text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition"
              onClick={onClose}
            >
              Stäng
            </button>
            <Link
              href={timeReportCreateLink}
              className="rounded-lg py-2.5 px-4 text-sm font-semibold text-white text-center transition hover:opacity-90"
              style={{ backgroundColor: '#2D5016' }}
              onClick={onClose}
            >
              Ny tidrapport
            </Link>
          </div>
          {!adminView ? (
            <Link
              href={absenceCreateLink}
              className="rounded-lg py-2.5 px-4 text-sm font-semibold text-center border border-violet-400 text-violet-950 bg-violet-50 hover:bg-violet-100 transition"
              onClick={onClose}
            >
              Ny frånvaro
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
