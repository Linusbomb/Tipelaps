'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SuccessDialog from '@/app/components/SuccessDialog'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import MonthAbsenceReportSection, {
  type MonthAbsenceRow,
} from '@/app/components/MonthAbsenceReportSection'
import MonthCustomerReportFolders, {
  groupReportsAsWorkHoursSection,
} from '@/app/components/MonthCustomerReportFolders'
import { absenceHoursForPayroll } from '@/lib/absence'
import {
  isDraftReportStatus,
  isFiledReportStatus,
  MY_REPORTS_STATUS_ALL_FILED,
} from '@/lib/reportStatus'
import MonthSubmissionReminder from '@/app/components/MonthSubmissionReminder'
import {
  buildMonthOptions,
  formatMonthYearSv,
  getPreviousMonthKey,
  resolveMonthReminder,
  toMonthKey,
} from '@/lib/monthReporting'

interface TimeReport {
  id: string
  date: string
  totalHours: number
  status: string
  month: string
  customer: {
    id: string
    name: string
  }
  project?: {
    id: string
    name: string
  } | null
  entries: Array<{
    id: string
    hours: number
    description: string
    machineHours?: number
  }>
}

type AbsenceReport = MonthAbsenceRow & {
  month: string
}

export default function MyReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<TimeReport[]>([])
  const [absences, setAbsences] = useState<AbsenceReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState(MY_REPORTS_STATUS_ALL_FILED)
  const [summaryStats, setSummaryStats] = useState({
    draftTimeCount: 0,
    draftAbsenceCount: 0,
    filedWorkHours: 0,
    filedAbsenceHours: 0,
    filedReportCount: 0,
    submittedCount: 0,
    approvedCount: 0,
    timeReportCount: 0,
    absenceReportCount: 0,
  })
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()))
  const [submitSuccess, setSubmitSuccess] = useState<{ title: string; message: string } | null>(null)
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set())
  const [submitConfirm, setSubmitConfirm] = useState<
    | { scope: 'all'; month: string; count: number }
    | { scope: 'selected'; month: string; count: number; reportIds: string[] }
    | null
  >(null)
  const [submittingMonth, setSubmittingMonth] = useState(false)
  const [submittingCustomerId, setSubmittingCustomerId] = useState<string | null>(null)
  const [reportToDelete, setReportToDelete] = useState<TimeReport | null>(null)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const monthOptions = buildMonthOptions(36)
  const [previousMonthDraftCount, setPreviousMonthDraftCount] = useState(0)

  useEffect(() => {
    fetchReports()
  }, [selectedStatus, selectedMonth])

  useEffect(() => {
    void fetchSummaryStats()
  }, [selectedMonth])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const prevMonth = getPreviousMonthKey()
    fetch(`/api/time-reports?month=${encodeURIComponent(prevMonth)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setPreviousMonthDraftCount(
          list.filter((r: { status: string }) => isDraftReportStatus(r.status)).length
        )
      })
      .catch(() => setPreviousMonthDraftCount(0))
  }, [selectedMonth])

  const fetchSummaryStats = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const params = new URLSearchParams({ month: selectedMonth })

      const headers = { Authorization: `Bearer ${token}` }
      const [reportsResponse, absencesResponse] = await Promise.all([
        fetch(`/api/time-reports?${params.toString()}`, { headers }),
        fetch(`/api/absence-reports?${params.toString()}`, { headers }),
      ])

      const timeRaw = reportsResponse.ok ? await reportsResponse.json() : []
      const absenceRaw = absencesResponse.ok ? await absencesResponse.json() : []
      const timeList: TimeReport[] = Array.isArray(timeRaw) ? timeRaw : []
      const absenceList: AbsenceReport[] = Array.isArray(absenceRaw) ? absenceRaw : []

      const filedTime = timeList.filter((r) => isFiledReportStatus(r.status))
      const filedAbsence = absenceList.filter((a) => isFiledReportStatus(a.status))

      setSummaryStats({
        draftTimeCount: timeList.filter((r) => isDraftReportStatus(r.status)).length,
        draftAbsenceCount: absenceList.filter((a) => isDraftReportStatus(a.status)).length,
        filedWorkHours: filedTime.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        filedAbsenceHours: filedAbsence.reduce(
          (sum, a) => sum + absenceHoursForPayroll(a.isFullDay, a.hours),
          0
        ),
        filedReportCount: filedTime.length + filedAbsence.length,
        submittedCount:
          timeList.filter((r) => r.status === 'SUBMITTED').length +
          absenceList.filter((a) => a.status === 'SUBMITTED').length,
        approvedCount:
          timeList.filter((r) => r.status === 'APPROVED').length +
          absenceList.filter((a) => a.status === 'APPROVED').length,
        timeReportCount: timeList.length,
        absenceReportCount: absenceList.length,
      })
    } catch (error) {
      console.error('Fel vid hämtning av sammanställning:', error)
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams({ month: selectedMonth })
      if (
        selectedStatus === 'DRAFT' ||
        selectedStatus === 'SUBMITTED' ||
        selectedStatus === 'APPROVED'
      ) {
        params.append('status', selectedStatus)
      }

      const absenceParams = new URLSearchParams(params)

      const headers = { Authorization: `Bearer ${token}` }
      const [reportsResponse, absencesResponse] = await Promise.all([
        fetch(`/api/time-reports?${params.toString()}`, { headers }),
        fetch(`/api/absence-reports?${absenceParams.toString()}`, { headers }),
      ])

      if (reportsResponse.status === 401 || absencesResponse.status === 401) {
        router.push('/login')
        return
      }

      if (reportsResponse.ok) {
        const data = await reportsResponse.json()
        let timeList: TimeReport[] = Array.isArray(data) ? data : []
        if (selectedStatus === MY_REPORTS_STATUS_ALL_FILED) {
          timeList = timeList.filter((r) => isFiledReportStatus(r.status))
        }
        setReports(timeList)
      } else {
        setReports([])
      }

      if (absencesResponse.ok) {
        const data = await absencesResponse.json()
        let absenceList: AbsenceReport[] = Array.isArray(data) ? data : []
        if (selectedStatus === MY_REPORTS_STATUS_ALL_FILED) {
          absenceList = absenceList.filter((a) => isFiledReportStatus(a.status))
        }
        setAbsences(absenceList)
      } else {
        setAbsences([])
      }
    } catch (error) {
      console.error('Fel vid hämtning av rapporter:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteReport = async (reportId: string) => {
    try {
      setDeletingReportId(reportId)
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/time-reports/${reportId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ta bort tidrapporten')
      }
      setReportToDelete(null)
      void fetchReports()
      void fetchSummaryStats()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte ta bort tidrapporten')
    } finally {
      setDeletingReportId(null)
    }
  }

  const submitMonth = async (month: string, opts?: { reportIds?: string[] }) => {
    try {
      setSubmittingMonth(true)

      const token = localStorage.getItem('token')
      const body: Record<string, unknown> = { month }
      if (opts?.reportIds && opts.reportIds.length > 0) {
        body.reportIds = opts.reportIds
      }

      const response = await fetch(`/api/time-reports/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({} as { message?: string }))
        setSubmitSuccess({
          title: 'Tidrapporter inskickade',
          message:
            data.message ||
            'Tidrapporterna har skickats till admin. Admin skapar fakturor och skickar till kund.',
        })
        void fetchReports()
        void fetchSummaryStats()
        setSelectedReportIds(new Set())
      } else {
        const data = await response.json()
        alert(data.error || 'Kunde inte skicka in tidrapporter')
      }
    } catch (error) {
      console.error('Fel vid inlämning:', error)
    } finally {
      setSubmittingMonth(false)
      setSubmittingCustomerId(null)
    }
  }

  const monthHasNoReports =
    summaryStats.timeReportCount + summaryStats.absenceReportCount === 0

  const monthGroupedReports = useMemo(() => {
    const grouped = groupReportsAsWorkHoursSection(reports)
    if (grouped.length > 0) return grouped
    return [
      {
        key: 'work-hours',
        customerId: 'work-hours',
        customerName: 'Arbetade timmar',
        reports: [],
        totalHours: 0,
        draftCount: 0,
        submittedCount: 0,
      },
    ]
  }, [reports])
  const isDraftView = selectedStatus === 'DRAFT'
  const monthDraftCount = summaryStats.draftTimeCount
  const totalDraftCount = summaryStats.draftTimeCount + summaryStats.draftAbsenceCount

  const monthReminder = resolveMonthReminder({
    viewMonth: selectedMonth,
    draftCountCurrentMonth: monthDraftCount,
    draftCountPreviousMonth: previousMonthDraftCount,
  })

  const draftReportIdsForMonth = useMemo(
    () => reports.filter((r) => r.status === 'DRAFT').map((r) => r.id),
    [reports]
  )

  useEffect(() => {
    setSelectedReportIds(new Set(draftReportIdsForMonth))
  }, [draftReportIdsForMonth.join(',')])

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }

  const toggleCustomerDrafts = (_customerId: string, draftIds: string[], checked: boolean) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev)
      for (const id of draftIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="app-title" style={{ color: '#2D5016' }}>
            Mina rapporter
          </h1>
          <Link
            href="/time-report"
            className="w-full sm:w-auto text-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Skapa ny rapport
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Filtrera efter status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value={MY_REPORTS_STATUS_ALL_FILED}>Alla (förutom utkast)</option>
              <option value="SUBMITTED">Inlämnade</option>
              <option value="APPROVED">Godkända</option>
              <option value="DRAFT">Utkast</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Filtrera efter månad:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              {monthOptions.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthYearSv(monthKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p>Laddar rapporter...</p>
          </div>
        ) : (
          <div>
            {monthReminder ? (
              <MonthSubmissionReminder
                message={monthReminder.message}
                kind={monthReminder.kind}
              />
            ) : null}
            <p className="text-sm text-gray-600 mb-4">
              {isDraftView
                ? `Utkast för ${formatMonthYearSv(selectedMonth)} — skicka in till admin när du är klar. Frånvaroutkast följer med vid «Skicka alla utkast».`
                : `Arbetade timmar för ${formatMonthYearSv(selectedMonth)}. Välj «Utkast» i filtret för att skicka in fler.`}
            </p>
            <MonthCustomerReportFolders
              groups={monthGroupedReports}
              showProjectColumn
              emptyListMessage="Inga tidrapporter för det valda filtret."
              totalDraftCount={isDraftView ? monthDraftCount : 0}
              selectedReportIds={selectedReportIds}
              onToggleReport={toggleReportSelection}
              onToggleCustomerDrafts={toggleCustomerDrafts}
              onSelectAllDrafts={() => setSelectedReportIds(new Set(draftReportIdsForMonth))}
              onClearSelection={() => setSelectedReportIds(new Set())}
              onSubmitSelected={() => {
                const ids = Array.from(selectedReportIds)
                if (ids.length === 0) {
                  alert('Välj minst en tidrapport att skicka in.')
                  return
                }
                setSubmitConfirm({
                  scope: 'selected',
                  month: selectedMonth,
                  count: ids.length,
                  reportIds: ids,
                })
              }}
              onSubmitAllDrafts={() =>
                setSubmitConfirm({ scope: 'all', month: selectedMonth, count: monthDraftCount })
              }
              submitting={submittingMonth}
              submittingCustomerId={submittingCustomerId}
              onDeleteReport={(r) => {
                const full = reports.find((rep) => rep.id === r.id)
                if (full) setReportToDelete(full)
              }}
              deletingReportId={deletingReportId}
            />
            <MonthAbsenceReportSection
              absences={absences}
              showSubmitHint={false}
              showWhenEmpty
              emptyMessage="Inga frånvarorapporter för det valda filtret."
            />
            {monthHasNoReports ? (
              <div className="text-center py-6 mt-2">
                <p className="text-gray-500">
                  Inga rapporter för {formatMonthYearSv(selectedMonth)} ännu.
                </p>
                <Link
                  href="/time-report"
                  className="mt-4 inline-block px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Skapa din första rapport
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Statistik för {formatMonthYearSv(selectedMonth)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Arbetade timmar</p>
              <p className="text-2xl font-bold tabular-nums">
                {summaryStats.filedWorkHours.toFixed(1)} h
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Frånvaro timmar</p>
              <p className="text-2xl font-bold tabular-nums">
                {summaryStats.filedAbsenceHours.toFixed(1)} h
              </p>
            </div>
            <div className="bg-amber-50/80 p-4 rounded border border-amber-100">
              <p className="text-sm text-gray-600">Utkast</p>
              <p className="text-2xl font-bold">{totalDraftCount}</p>
              <p className="text-xs text-gray-600 mt-1">Kvar att skicka in</p>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Inlämnade</p>
              <p className="text-2xl font-bold">{summaryStats.submittedCount}</p>
              <p className="text-xs text-gray-500 mt-1">Väntar på godkännande</p>
            </div>
            <div className="bg-green-50/80 p-4 rounded border border-green-100">
              <p className="text-sm text-gray-600">Godkända</p>
              <p className="text-2xl font-bold">{summaryStats.approvedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={reportToDelete !== null}
        title="Ta bort tidrapport?"
        message={
          reportToDelete
            ? `Vill du ta bort tidrapporten${reportToDelete.project?.name ? ` (${reportToDelete.project.name})` : ''} den ${new Date(reportToDelete.date).toLocaleDateString('sv-SE')}? Detta går inte att ångra.`
            : ''
        }
        confirmLabel="Ja, ta bort"
        onCancel={() => {
          if (!deletingReportId) setReportToDelete(null)
        }}
        onConfirm={() => {
          if (reportToDelete) void deleteReport(reportToDelete.id)
        }}
      />

      <ConfirmDialog
        open={submitConfirm !== null}
        title={
          submitConfirm?.scope === 'selected'
            ? 'Skicka valda till admin?'
            : 'Skicka alla utkast till admin?'
        }
        message={
          submitConfirm
            ? submitConfirm.scope === 'selected'
              ? `Du skickar in ${submitConfirm.count} valda tidrapport${submitConfirm.count === 1 ? '' : 'er'} för ${formatMonthYearSv(submitConfirm.month)} till admin. Fortsätta?`
              : `Du skickar in alla ${submitConfirm.count} utkast (som inte redan är inskickade) för ${formatMonthYearSv(submitConfirm.month)} till admin. Fortsätta?`
            : ''
        }
        confirmLabel="Ja, skicka in"
        onCancel={() => setSubmitConfirm(null)}
        onConfirm={() => {
          if (!submitConfirm) return
          const pending = submitConfirm
          setSubmitConfirm(null)
          if (pending.scope === 'selected') {
            void submitMonth(pending.month, { reportIds: pending.reportIds })
          } else {
            void submitMonth(pending.month)
          }
        }}
      />

      <SuccessDialog
        open={submitSuccess !== null}
        title={submitSuccess?.title ?? ''}
        message={submitSuccess?.message ?? ''}
        onClose={() => setSubmitSuccess(null)}
      />
    </div>
  )
}