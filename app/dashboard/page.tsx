'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import Link from 'next/link'
import OverviewStatisticsSubNav, {
  type DashboardViewTab,
} from '@/app/components/OverviewStatisticsSubNav'
import DashboardStatisticsPanel from '@/app/components/DashboardStatisticsPanel'
import MonthSubmissionReminder from '@/app/components/MonthSubmissionReminder'
import MonthDayCoveragePanel from '@/app/components/MonthDayCoveragePanel'
import AdminMonthCoveragePanel from '@/app/components/AdminMonthCoveragePanel'
import type { DayCoverage, MonthCoverageSummary } from '@/lib/monthDayCoverage'
import {
  getPreviousMonthKey,
  resolveMonthReminder,
  TIME_REPORT_SUBMIT_TAB_HREF,
  TIME_REPORT_SUBMIT_TAB_LABEL,
} from '@/lib/monthReporting'
import { absenceHoursForPayroll } from '@/lib/absence'
import { isDraftReportStatus, isFiledReportStatus } from '@/lib/reportStatus'

type AbsenceRow = {
  isFullDay: boolean
  hours: number | null
}

function sumAbsenceHours(rows: AbsenceRow[]): number {
  return rows.reduce(
    (sum, row) => sum + absenceHoursForPayroll(row.isFullDay, row.hours),
    0
  )
}

type Employee = {
  id: string
  name: string
  email: string
}

function isAdminRole(role: string | null) {
  return role === 'ENTREPRENEUR' || role === 'PAYROLL_COORDINATOR'
}

export default function DashboardPage() {
  const { t } = useLanguage()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(new Date())
  const [showMonthModal, setShowMonthModal] = useState(false)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState({
    totalReports: 0,
    totalHours: 0,
    totalAbsenceHours: 0,
    draftCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [coverageLoading, setCoverageLoading] = useState(true)
  const [monthCoverage, setMonthCoverage] = useState<{
    days: DayCoverage[]
    summary: MonthCoverageSummary
    warnings: DayCoverage[]
    hasWarnings: boolean
  } | null>(null)
  const [adminCoverage, setAdminCoverage] = useState<{
    employees: Array<{
      userId: string
      name: string
      summary: MonthCoverageSummary
      days: DayCoverage[]
      warnings: DayCoverage[]
      hasWarnings: boolean
    }>
    companySummary: {
      employeeCount: number
      employeesWithIssues: number
      totalMissingWeekdays: number
      totalPartialWeekdays: number
    }
  } | null>(null)
  const [previousMonthDraftCount, setPreviousMonthDraftCount] = useState(0)
  const [dashboardTab, setDashboardTab] = useState<DashboardViewTab>('overview')
  const [statisticsMounted, setStatisticsMounted] = useState(false)
  const selectedMonth = selectedMonthDate
    ? `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { role?: string }
        setUserRole(parsed.role ?? null)
      } catch {
        setUserRole(null)
      }
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'statistics') {
        setDashboardTab('statistics')
        setStatisticsMounted(true)
      }
    }
  }, [])

  const handleDashboardTabChange = (tab: DashboardViewTab) => {
    setDashboardTab(tab)
    if (tab === 'statistics') setStatisticsMounted(true)
    const url = tab === 'statistics' ? '/dashboard?tab=statistics' : '/dashboard'
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url)
    }
  }

  const isAdmin = isAdminRole(userRole)

  useEffect(() => {
    if (userRole === null) return
    const admin = isAdminRole(userRole)
    fetchStats(admin)
    void fetchMonthCoverage(admin)
    if (!admin) {
      const token = localStorage.getItem('token')
      if (token) {
        const prevMonth = getPreviousMonthKey()
        fetch(`/api/time-reports?month=${encodeURIComponent(prevMonth)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            const list = Array.isArray(data) ? data : []
            setPreviousMonthDraftCount(
              list.filter((r: { status: string }) => r.status === 'DRAFT').length
            )
          })
          .catch(() => setPreviousMonthDraftCount(0))
      }
    }
  }, [selectedMonth, userRole])

  const fetchStats = async (admin: boolean) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const reportsUrl = admin
        ? `/api/admin/time-reports?status=ALL&month=${selectedMonth}`
        : `/api/time-reports?month=${selectedMonth}`
      const absencesUrl = admin
        ? `/api/admin/absence-reports?month=${encodeURIComponent(selectedMonth)}`
        : `/api/absence-reports?month=${encodeURIComponent(selectedMonth)}`

      const headers = { Authorization: `Bearer ${token}` }
      const [reportsResponse, absencesResponse] = await Promise.all([
        fetch(reportsUrl, { headers }),
        fetch(absencesUrl, { headers }),
      ])

      if (reportsResponse.status === 401 || absencesResponse.status === 401) {
        window.location.href = '/login'
        return
      }

      if (reportsResponse.ok) {
        const reports = await reportsResponse.json()
        const absences = absencesResponse.ok
          ? await absencesResponse.json()
          : []
        const absenceList = Array.isArray(absences) ? absences : []

        const filedTimeReports = reports.filter((r: { status: string }) =>
          isFiledReportStatus(r.status)
        )
        const filedAbsenceList = absenceList.filter((a: { status: string }) =>
          isFiledReportStatus(a.status)
        )
        const draftTimeCount = reports.filter((r: { status: string }) =>
          isDraftReportStatus(r.status)
        ).length
        const draftAbsenceCount = absenceList.filter((a: { status: string }) =>
          isDraftReportStatus(a.status)
        ).length

        setStats({
          totalReports: filedTimeReports.length + filedAbsenceList.length,
          totalHours: filedTimeReports.reduce(
            (sum: number, r: { totalHours?: number }) => sum + (r.totalHours || 0),
            0
          ),
          totalAbsenceHours: sumAbsenceHours(filedAbsenceList),
          draftCount: draftTimeCount + draftAbsenceCount,
        })
      }
    } catch (error) {
      console.error('Fel vid hämtning av statistik:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthCoverage = async (admin: boolean) => {
    try {
      setCoverageLoading(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const url = admin
        ? `/api/admin/month-coverage?month=${encodeURIComponent(selectedMonth)}`
        : `/api/month-coverage?month=${encodeURIComponent(selectedMonth)}`

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        setMonthCoverage(null)
        setAdminCoverage(null)
        return
      }

      const data = await response.json()
      if (admin) {
        setAdminCoverage({
          employees: data.employees ?? [],
          companySummary: data.companySummary ?? {
            employeeCount: 0,
            employeesWithIssues: 0,
            totalMissingWeekdays: 0,
            totalPartialWeekdays: 0,
          },
        })
        setMonthCoverage(null)
      } else {
        setMonthCoverage({
          days: data.days ?? [],
          summary: data.summary ?? {
            complete: 0,
            partial: 0,
            missing: 0,
            future: 0,
            weekend: 0,
          },
          warnings: data.warnings ?? [],
          hasWarnings: Boolean(data.hasWarnings),
        })
        setAdminCoverage(null)
      }
    } catch (error) {
      console.error('Fel vid hämtning av månadsöversikt:', error)
      setMonthCoverage(null)
      setAdminCoverage(null)
    } finally {
      setCoverageLoading(false)
    }
  }

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('sv-SE', {
    month: 'long',
  })
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  const monthNames = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]

  const dashboardReminder =
    !isAdmin && userRole
      ? resolveMonthReminder({
          viewMonth: selectedMonth,
          draftCountCurrentMonth: stats.draftCount,
          draftCountPreviousMonth: previousMonthDraftCount,
        })
      : null

  const openMonthPicker = () => {
    if (selectedMonthDate) {
      setPickerYear(selectedMonthDate.getFullYear())
    }
    setShowMonthModal(true)
  }

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        {isAdmin && (
          <OverviewStatisticsSubNav
            activeTab={dashboardTab}
            onTabChange={handleDashboardTabChange}
          />
        )}

        {dashboardReminder && dashboardTab === 'overview' ? (
          <MonthSubmissionReminder
            message={dashboardReminder.message}
            kind={dashboardReminder.kind}
            actionHref={TIME_REPORT_SUBMIT_TAB_HREF}
            actionLabel={TIME_REPORT_SUBMIT_TAB_LABEL}
          />
        ) : null}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="app-title" style={{ color: '#2D5016' }}>
            {dashboardTab === 'statistics' ? 'Statistik' : `Överblick ${capitalizedMonthLabel}`}
          </h1>
          {dashboardTab === 'overview' ? (
            <button
              type="button"
              onClick={openMonthPicker}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-left md:min-w-[220px] shadow-sm"
            >
              Välj månad: {capitalizedMonthLabel} {selectedMonthDate?.getFullYear()}
            </button>
          ) : null}
        </div>

        {isAdmin && statisticsMounted && dashboardTab === 'statistics' ? (
          <DashboardStatisticsPanel />
        ) : null}

        {dashboardTab === 'overview' && loading ? (
          <p>Laddar...</p>
        ) : dashboardTab === 'overview' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Inlämnade rapporter</h3>
              <p className="text-3xl font-bold">{stats.totalReports}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Arbetade timmar</h3>
              <p className="text-3xl font-bold tabular-nums">{stats.totalHours.toFixed(1)} h</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Frånvaro timmar</h3>
              <p className="text-3xl font-bold tabular-nums">{stats.totalAbsenceHours.toFixed(1)} h</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Utkast</h3>
              <p className="text-3xl font-bold">{stats.draftCount}</p>
            </div>
          </div>
        ) : null}

        {dashboardTab === 'overview' && coverageLoading ? (
          isAdmin ? (
            <AdminMonthCoveragePanel month={selectedMonth} employees={[]} companySummary={{
              employeeCount: 0,
              employeesWithIssues: 0,
              totalMissingWeekdays: 0,
              totalPartialWeekdays: 0,
            }} loading />
          ) : (
            <MonthDayCoveragePanel
              month={selectedMonth}
              days={[]}
              summary={{ complete: 0, partial: 0, missing: 0, future: 0, weekend: 0 }}
              warnings={[]}
              hasWarnings={false}
              loading
            />
          )
        ) : dashboardTab === 'overview' && isAdmin && adminCoverage ? (
          <AdminMonthCoveragePanel
            month={selectedMonth}
            employees={adminCoverage.employees}
            companySummary={adminCoverage.companySummary}
          />
        ) : dashboardTab === 'overview' && !isAdmin && monthCoverage ? (
          <MonthDayCoveragePanel
            month={selectedMonth}
            days={monthCoverage.days}
            summary={monthCoverage.summary}
            warnings={monthCoverage.warnings}
            hasWarnings={monthCoverage.hasWarnings}
          />
        ) : null}

        {dashboardTab === 'overview' ? (
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {isAdmin && (
            <>
              <Link
                href="/admin"
                className="w-full sm:w-auto text-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Gå till Admin
              </Link>
              <Link
                href="/admin/customers"
                className="w-full sm:w-auto text-center px-6 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Aktiva kunder
              </Link>
            </>
          )}
          <Link
            href="/time-report"
            className="w-full sm:w-auto text-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Skapa tidrapport
          </Link>
          {!isAdmin && (
            <Link
              href="/my-reports"
              className="w-full sm:w-auto text-center px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Mina rapporter
            </Link>
          )}
        </div>
        ) : null}
      </div>

      {showMonthModal && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setPickerYear((prev) => prev - 1)}
                className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                ‹
              </button>
              <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
                Välj månad ({pickerYear})
              </h2>
              <button
                type="button"
                onClick={() => setPickerYear((prev) => prev + 1)}
                className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-5">
              {monthNames.map((name, index) => {
                const isSelected =
                  selectedMonthDate?.getFullYear() === pickerYear &&
                  selectedMonthDate?.getMonth() === index

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedMonthDate(new Date(pickerYear, index, 1))
                      setShowMonthModal(false)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium border transition ${
                      isSelected
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-green-50 hover:border-green-300'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>

            <div className="px-5 pb-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}