'use client'

import { useState, useEffect, useMemo } from 'react'
import { absenceHoursForPayroll } from '@/lib/absence'
import RelatedProjectTimeReportsPanel from '@/app/components/RelatedProjectTimeReportsPanel'

interface Employee {
  id: string
  name: string
  email: string
}

interface TimeReport {
  id: string
  date: string
  totalHours: number
  status: string
  user: Employee
  userId?: string
  customer?: {
    id: string
    name: string
  }
}

interface MonthlyCustomerStat {
  key: string
  customerName: string
  invoiceHours: number
  reportCount: number
}

interface YearlyCustomerStat {
  key: string
  customerName: string
  invoiceHours: number
  reportCount: number
}

interface CompletedCompletion {
  projectEmployeeId: string
  projectId: string
  projectName: string
  projectAddress: string
  projectDescription: string | null
  projectStartDate: string
  latitude: number | null
  longitude: number | null
  customerName: string
  assignedEquipment: string | null
  employeeName: string
  employeeEmail: string
  completedAt: string | null
}

interface CompletedProjectsResponse {
  year: number
  completionCount: number
  uniqueProjectCount: number
  completions: CompletedCompletion[]
}

const COMPLETED_PROJECTS_PAGE_SIZE = 5

type CompletedProjectGroup = {
  projectId: string
  projectName: string
  projectAddress: string
  projectDescription: string | null
  projectStartDate: string
  latitude: number | null
  longitude: number | null
  customerName: string
  completions: CompletedCompletion[]
  latestCompletedAt: string | null
}

function groupCompletedProjects(completions: CompletedCompletion[]): CompletedProjectGroup[] {
  const map = new Map<string, CompletedProjectGroup>()
  for (const row of completions) {
    let group = map.get(row.projectId)
    if (!group) {
      group = {
        projectId: row.projectId,
        projectName: row.projectName,
        projectAddress: row.projectAddress,
        projectDescription: row.projectDescription,
        projectStartDate: row.projectStartDate,
        latitude: row.latitude,
        longitude: row.longitude,
        customerName: row.customerName,
        completions: [],
        latestCompletedAt: null,
      }
      map.set(row.projectId, group)
    }
    group.completions.push(row)
    const rowMs = row.completedAt ? new Date(row.completedAt).getTime() : 0
    const prevMs = group.latestCompletedAt ? new Date(group.latestCompletedAt).getTime() : 0
    if (rowMs > prevMs) group.latestCompletedAt = row.completedAt
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.latestCompletedAt ? new Date(a.latestCompletedAt).getTime() : 0
    const tb = b.latestCompletedAt ? new Date(b.latestCompletedAt).getTime() : 0
    return tb - ta
  })
}

function formatDateTimeSv(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return '—'
  }
}

/** Admin-statistik (fakturering, årsöverblick, slutförda projekt) — samma visuella språk som överblick. */
export default function DashboardStatisticsPanel() {
  const [reportsByEmployee, setReportsByEmployee] = useState<Record<string, TimeReport[]>>({})
  const [absenceReports, setAbsenceReports] = useState<
    Array<{
      date: string
      status: string
      isFullDay: boolean
      hours: number | null
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [companyStartYear, setCompanyStartYear] = useState(new Date().getFullYear())
  const [completedProjects, setCompletedProjects] = useState<CompletedProjectsResponse | null>(null)
  const [completedLoading, setCompletedLoading] = useState(false)
  const [completedProjectsYear, setCompletedProjectsYear] = useState(() => new Date().getFullYear())
  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(() => new Set())
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_PROJECTS_PAGE_SIZE)

  useEffect(() => {
    void fetchData()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setCompletedLoading(true)
        const token = localStorage.getItem('token')
        if (!token) return

        const res = await fetch(
          `/api/admin/statistics/completed-projects?year=${encodeURIComponent(String(completedProjectsYear))}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (cancelled) return
        if (res.ok) {
          const data: CompletedProjectsResponse = await res.json()
          setCompletedProjects(data)
        } else {
          setCompletedProjects(null)
        }
      } catch {
        if (!cancelled) setCompletedProjects(null)
      } finally {
        if (!cancelled) setCompletedLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [completedProjectsYear])

  useEffect(() => {
    setCompletedVisibleCount(COMPLETED_PROJECTS_PAGE_SIZE)
    setOpenProjectIds(new Set())
  }, [completedProjectsYear, completedProjects?.completions.length])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const [reportsRes, absenceRes, companyRes] = await Promise.all([
        fetch('/api/admin/time-reports?status=ALL', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/absence-reports', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/company/logo', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (absenceRes.ok) {
        const absenceData = await absenceRes.json()
        setAbsenceReports(Array.isArray(absenceData) ? absenceData : [])
      } else {
        setAbsenceReports([])
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json()
        const grouped: Record<string, TimeReport[]> = {}

        reportsData.forEach((report: TimeReport) => {
          const employeeId = report.userId || report.user.id
          if (!grouped[employeeId]) {
            grouped[employeeId] = []
          }
          grouped[employeeId].push(report)
        })

        setReportsByEmployee(grouped)
      }

      if (companyRes.ok) {
        const companyData = await companyRes.json()
        if (companyData?.companyCreatedAt) {
          const startYear = new Date(companyData.companyCreatedAt).getFullYear()
          if (!Number.isNaN(startYear)) {
            setCompanyStartYear(startYear)
            setSelectedYear((prev) => (prev < startYear ? startYear : prev))
            setCompletedProjectsYear((prev) => (prev < startYear ? startYear : prev))
          }
        }
      }
    } catch (err) {
      console.error('Fel vid hämtning av data:', err)
    } finally {
      setLoading(false)
    }
  }

  const allReports = Object.values(reportsByEmployee).flat()
  const approvedReports = allReports.filter((report) => report.status === 'APPROVED')
  const approvedAbsences = absenceReports.filter((row) => row.status === 'APPROVED')

  const absenceHoursForRow = (row: { isFullDay: boolean; hours: number | null }) =>
    absenceHoursForPayroll(row.isFullDay, row.hours)
  const monthFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'long' })
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index,
    label: monthFormatter.format(new Date(2026, index, 1)),
  }))

  const availableYears = Array.from(
    new Set(approvedReports.map((report) => new Date(report.date).getFullYear()))
  ).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const endYear = currentYear
  const safeCompanyStartYear = Math.min(companyStartYear, endYear)
  const yearRange = Array.from(
    { length: Math.max(1, endYear - safeCompanyStartYear + 1) },
    (_, index) => safeCompanyStartYear + index
  )
  const yearOptions = Array.from(
    new Set([
      ...yearRange,
      ...availableYears.filter((year) => year >= safeCompanyStartYear && year <= endYear),
      Math.max(safeCompanyStartYear, Math.min(selectedYear, endYear)),
    ])
  ).sort((a, b) => b - a)
  const completedAvailableYears = Array.from(
    new Set(
      (completedProjects?.completions || []).map((item) =>
        new Date(item.completedAt || item.projectStartDate).getFullYear()
      )
    )
  ).sort((a, b) => b - a)
  const completedYearOptions = Array.from(
    new Set([
      ...yearRange,
      ...completedAvailableYears.filter((year) => year >= safeCompanyStartYear && year <= endYear),
      Math.max(safeCompanyStartYear, Math.min(completedProjectsYear, endYear)),
    ])
  ).sort((a, b) => b - a)

  const monthlyByCustomer = Object.values(
    approvedReports
      .filter((report) => new Date(report.date).getMonth() === selectedMonth)
      .reduce((acc: Record<string, MonthlyCustomerStat>, report) => {
        if (!report.customer?.id || !report.customer?.name) return acc

        const key = report.customer.id
        const invoiceHours = report.totalHours || 0

        if (!acc[key]) {
          acc[key] = {
            key,
            customerName: report.customer.name,
            invoiceHours: 0,
            reportCount: 0,
          }
        }

        acc[key].invoiceHours += invoiceHours
        acc[key].reportCount += 1
        return acc
      }, {})
  ).sort((a, b) => b.invoiceHours - a.invoiceHours)
  const selectedMonthName =
    monthOptions.find((month) => month.value === selectedMonth)?.label?.toUpperCase() || ''
  const monthlyTotal = monthlyByCustomer.reduce((sum, item) => sum + item.invoiceHours, 0)
  const monthlyAbsenceTotal = approvedAbsences
    .filter((row) => new Date(row.date).getMonth() === selectedMonth)
    .reduce((sum, row) => sum + absenceHoursForRow(row), 0)

  const yearlyByCustomer = Object.values(
    approvedReports
      .filter((report) => new Date(report.date).getFullYear() === selectedYear)
      .reduce((acc: Record<string, YearlyCustomerStat>, report) => {
        if (!report.customer?.id || !report.customer?.name) return acc

        const key = report.customer.id
        const invoiceHours = report.totalHours || 0

        if (!acc[key]) {
          acc[key] = {
            key,
            customerName: report.customer.name,
            invoiceHours: 0,
            reportCount: 0,
          }
        }

        acc[key].invoiceHours += invoiceHours
        acc[key].reportCount += 1
        return acc
      }, {})
  ).sort((a, b) => b.invoiceHours - a.invoiceHours)

  const yearlyTotal = yearlyByCustomer.reduce((sum, item) => sum + item.invoiceHours, 0)
  const yearlyAbsenceTotal = approvedAbsences
    .filter((row) => new Date(row.date).getFullYear() === selectedYear)
    .reduce((sum, row) => sum + absenceHoursForRow(row), 0)

  const completedByMonth = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthCompletions = (completedProjects?.completions || []).filter((row) => {
      const d = row.completedAt ? new Date(row.completedAt) : new Date(row.projectStartDate)
      return d.getFullYear() === completedProjectsYear && d.getMonth() === monthIndex
    })
    return {
      monthIndex,
      monthName: monthFormatter.format(new Date(completedProjectsYear, monthIndex, 1)),
      completionCount: monthCompletions.length,
      uniqueProjectCount: new Set(monthCompletions.map((row) => row.projectId)).size,
    }
  })
  const completedByMonthVisible = completedByMonth.filter((item) => item.completionCount > 0)

  const completedProjectGroups = useMemo(
    () => groupCompletedProjects(completedProjects?.completions ?? []),
    [completedProjects?.completions]
  )
  const visibleCompletedProjects = completedProjectGroups.slice(0, completedVisibleCount)

  const markProjectOpen = (projectId: string) => {
    setOpenProjectIds((prev) => {
      if (prev.has(projectId)) return prev
      const next = new Set(prev)
      next.add(projectId)
      return next
    })
  }

  const selectClass =
    'px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-left shadow-sm'

  if (loading) {
    return <p className="text-gray-700">Laddar statistik…</p>
  }

  return (
    <>
      {approvedReports.length === 0 && approvedAbsences.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <p className="text-gray-600 italic">
            Ingen godkänd tidrapport att visa för fakturering ännu.
          </p>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
                Timmar per kund och månad
              </h2>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={selectClass}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {monthlyByCustomer.length === 0 ? (
              <p className="text-gray-600 italic mb-4">
                Ingen fakturering hittades för {selectedMonthName}.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {monthlyByCustomer.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col md:flex-row md:items-center md:justify-between bg-white border border-gray-200 rounded-md px-4 py-3"
                  >
                    <p className="font-medium text-gray-900">{item.customerName}</p>
                    <p className="text-gray-700 tabular-nums">
                      {selectedMonthName}:{' '}
                      <span className="font-bold">{item.invoiceHours.toFixed(1)} h</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-1 text-right text-sm">
              <p className="font-semibold text-gray-900 tabular-nums">
                Arbetade timmar {selectedMonthName}: {monthlyTotal.toFixed(1)} h
              </p>
              <p className="text-gray-700 tabular-nums">
                Frånvaro {selectedMonthName}:{' '}
                <span className="font-semibold">{monthlyAbsenceTotal.toFixed(1)} h</span>
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
                Årsöverblick per kund
              </h2>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={selectClass}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {yearlyByCustomer.length === 0 ? (
              <p className="text-gray-600 italic mb-4">Ingen fakturering hittades för valt år.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {yearlyByCustomer.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col md:flex-row md:items-center md:justify-between bg-white border border-gray-200 rounded-md px-4 py-3"
                  >
                    <p className="font-medium text-gray-900">{item.customerName}</p>
                    <p className="text-gray-700 tabular-nums">
                      Årssumma: <span className="font-bold">{item.invoiceHours.toFixed(1)} h</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-1 text-right text-sm">
              <p className="font-semibold text-gray-900 tabular-nums">
                Arbetade timmar {selectedYear}: {yearlyTotal.toFixed(1)} h
              </p>
              <p className="text-gray-700 tabular-nums">
                Frånvaro {selectedYear}:{' '}
                <span className="font-semibold">{yearlyAbsenceTotal.toFixed(1)} h</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-6 rounded-lg">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
              Slutförda projekt
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Uppdrag som personal markerat som slutfört listas för det år då avslutet registrerades.
            </p>
          </div>
          <div className="shrink-0">
            <label className="block text-xs text-gray-500 mb-1">År för projekt</label>
            <select
              value={completedProjectsYear}
              onChange={(e) => setCompletedProjectsYear(Number(e.target.value))}
              className={selectClass}
            >
              {completedYearOptions.map((year) => (
                <option key={`proj-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {completedLoading ? (
          <p className="text-gray-600 py-4">Laddar projektstatistik…</p>
        ) : !completedProjects || completedProjects.completions.length === 0 ? (
          <p className="text-gray-600 italic">
            Inga slutförda projekt för {completedProjectsYear}.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-6 mb-6 text-sm">
              <p>
                <span className="text-gray-600">Unika projekt:</span>{' '}
                <span className="font-semibold">{completedProjects.uniqueProjectCount}</span>
              </p>
              <p>
                <span className="text-gray-600">Slutföranden:</span>{' '}
                <span className="font-semibold" style={{ color: '#2D5016' }}>
                  {completedProjects.completionCount}
                </span>
              </p>
            </div>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Månad för månad ({completedProjectsYear})
              </h3>
              {completedByMonthVisible.length === 0 ? (
                <p className="text-sm text-gray-600 italic">Inga slutförda projekt för valt år.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {completedByMonthVisible.map((item) => (
                    <div
                      key={`month-${item.monthIndex}`}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-2"
                    >
                      <span className="text-gray-800">
                        {item.monthName.charAt(0).toUpperCase() + item.monthName.slice(1)}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {item.uniqueProjectCount} projekt / {item.completionCount} slutföranden
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Klicka på ett projekt för att se timmar, bilder och vilka som slutfört.
            </p>
            <div className="space-y-2">
              {visibleCompletedProjects.map((project) => (
                <details
                  key={project.projectId}
                  className="border border-gray-200 rounded-lg bg-white overflow-hidden group"
                  onToggle={(e) => {
                    if (e.currentTarget.open) markProjectOpen(project.projectId)
                  }}
                >
                  <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden hover:bg-emerald-50/40">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-gray-900 block">{project.projectName}</span>
                      <span className="text-xs text-gray-500 block mt-0.5">{project.projectAddress}</span>
                      <span className="text-xs text-gray-600 mt-1 block">
                        {project.customerName} · {project.completions.length}{' '}
                        {project.completions.length === 1 ? 'slutförande' : 'slutföranden'}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 shrink-0 text-xs">
                      <span className="text-gray-500 group-open:hidden">Visa timmar</span>
                      <span className="hidden group-open:inline text-gray-600">Dölj</span>
                      <span className="text-gray-700 tabular-nums whitespace-nowrap">
                        Senast: {formatDateTimeSv(project.latestCompletedAt)}
                      </span>
                    </span>
                  </summary>
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-4 text-sm">
                    {project.projectDescription?.trim() ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Information
                        </p>
                        <p className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                          {project.projectDescription}
                        </p>
                      </div>
                    ) : null}
                    {project.latitude != null &&
                    project.longitude != null &&
                    !Number.isNaN(project.latitude) &&
                    !Number.isNaN(project.longitude) ? (
                      <p>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${project.latitude}&mlon=${project.longitude}&zoom=16`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                          style={{ color: '#2D5016' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Öppna plats på karta
                        </a>
                      </p>
                    ) : null}

                    {openProjectIds.has(project.projectId) ? (
                      <RelatedProjectTimeReportsPanel
                        projectId={project.projectId}
                        variant="embedded"
                      />
                    ) : null}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Markerat slutfört av
                      </p>
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
                        {project.completions.map((row) => (
                          <li
                            key={row.projectEmployeeId}
                            className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1 bg-gray-50/50"
                          >
                            <span>
                              <span className="font-medium text-gray-900">{row.employeeName}</span>
                              {row.assignedEquipment?.trim() ? (
                                <span className="text-gray-600"> · {row.assignedEquipment}</span>
                              ) : null}
                            </span>
                            <span className="text-gray-600 tabular-nums text-xs sm:text-sm">
                              {formatDateTimeSv(row.completedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              ))}
            </div>
            {completedProjectGroups.length > completedVisibleCount && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setCompletedVisibleCount((prev) => prev + COMPLETED_PROJECTS_PAGE_SIZE)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Visa fler projekt
                </button>
              </div>
            )}
            {completedVisibleCount > COMPLETED_PROJECTS_PAGE_SIZE && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setCompletedVisibleCount(COMPLETED_PROJECTS_PAGE_SIZE)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                >
                  Visa färre projekt
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </>
  )
}
