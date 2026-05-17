'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import OverviewStatisticsSubNav from '@/app/components/OverviewStatisticsSubNav'

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
  customerTotalHours?: number
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

export default function StatisticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [reportsByEmployee, setReportsByEmployee] = useState<Record<string, TimeReport[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [companyStartYear, setCompanyStartYear] = useState(new Date().getFullYear())
  const [completedProjects, setCompletedProjects] = useState<CompletedProjectsResponse | null>(null)
  const [completedLoading, setCompletedLoading] = useState(false)
  const [completedProjectsYear, setCompletedProjectsYear] = useState(() => new Date().getFullYear())
  const [completedProjectDetail, setCompletedProjectDetail] = useState<CompletedCompletion | null>(null)
  const [completedVisibleCount, setCompletedVisibleCount] = useState(COMPLETED_PROJECTS_PAGE_SIZE)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')

      if (!token || !userData) {
        window.location.href = '/login'
        return
      }

      try {
        const parsedUser = JSON.parse(userData)
        if (parsedUser.role !== 'ENTREPRENEUR' && parsedUser.role !== 'PAYROLL_COORDINATOR') {
          window.location.href = '/time-report'
          return
        }

        setUser(parsedUser)
        fetchData()
      } catch (err) {
        console.error('Fel vid parsing av användardata:', err)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (!user) return

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
  }, [user, completedProjectsYear])

  useEffect(() => {
    setCompletedVisibleCount(COMPLETED_PROJECTS_PAGE_SIZE)
  }, [completedProjectsYear, completedProjects?.completions.length])

  useEffect(() => {
    if (!completedProjectDetail) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setCompletedProjectDetail(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [completedProjectDetail])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const [reportsRes, companyRes] = await Promise.all([
        fetch('/api/admin/time-reports?status=ALL', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/company/logo', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

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

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) {
    return <div className="p-8">Laddar...</div>
  }

  const allReports = Object.values(reportsByEmployee).flat()
  const approvedReports = allReports.filter((report) => report.status === 'APPROVED')
  const monthFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'long' })
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index,
    label: monthFormatter.format(new Date(2026, index, 1)),
  }))

  const availableYears = Array.from(
    new Set(approvedReports.map((report) => new Date(report.date).getFullYear()))
  ).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const endYear = currentYear + 15
  const yearRange = Array.from({ length: endYear - companyStartYear + 1 }, (_, index) => companyStartYear + index)
  const yearOptions = Array.from(
    new Set([...yearRange, ...availableYears.filter((year) => year >= companyStartYear), selectedYear])
  ).sort((a, b) => b - a)

  const monthlyByCustomer = Object.values(
    approvedReports
      .filter((report) => new Date(report.date).getMonth() === selectedMonth)
      .reduce((acc: Record<string, MonthlyCustomerStat>, report) => {
      if (!report.customer?.id || !report.customer?.name) return acc

      const key = report.customer.id
      /** Fakturerbar tid för kunden = vald arbetstid för rapporten (fordon + övrig tid ingår). */
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
  const selectedMonthName = monthOptions.find((month) => month.value === selectedMonth)?.label?.toUpperCase() || ''
  const monthlyTotal = monthlyByCustomer.reduce((sum, item) => sum + item.invoiceHours, 0)

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

  return (
    <div className="app-shell-wide">
      <OverviewStatisticsSubNav />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8">
        <h1 className="app-title text-gray-900">Statistik</h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-700">Hej, {user.name}!</span>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logga ut
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Laddar statistik...</div>
      ) : (
        <div className="space-y-6">
          {approvedReports.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-500 italic">Ingen godkänd tidrapport att visa för fakturering ännu.</p>
            </div>
          ) : (
            <>
              <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">Timmar per kund och månad</h2>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md md:min-w-[180px]"
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {monthlyByCustomer.length === 0 ? (
              <p className="text-gray-500 italic">Ingen fakturering hittades för {selectedMonthName}.</p>
            ) : (
              <div className="space-y-3">
                {monthlyByCustomer.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-300 rounded-md p-4"
                  >
                    <p className="text-gray-900 font-medium">{item.customerName}</p>
                    <p className="text-gray-700">
                      {selectedMonthName}: <span className="font-semibold text-gray-900">{item.invoiceHours.toFixed(1)} h</span>
                    </p>
                  </div>
                ))}

                <div className="border-t border-gray-300 pt-4 mt-4 flex justify-end">
                  <p className="text-gray-900 font-semibold">
                    Totalt {selectedMonthName}: {monthlyTotal.toFixed(1)} h
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">Årsöverblick per kund</h2>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {yearlyByCustomer.length === 0 ? (
              <p className="text-gray-500 italic">Ingen fakturering hittades för valt år.</p>
            ) : (
              <div className="space-y-3">
                {yearlyByCustomer.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-300 rounded-md p-4"
                  >
                    <p className="text-gray-900 font-medium">{item.customerName}</p>
                    <p className="text-gray-700">
                      Årssumma: <span className="font-semibold text-gray-900">{item.invoiceHours.toFixed(1)} h</span>
                    </p>
                  </div>
                ))}

                <div className="border-t border-gray-300 pt-4 mt-4 flex justify-end">
                  <p className="text-gray-900 font-semibold">
                    Totalt {selectedYear}: {yearlyTotal.toFixed(1)} h
                  </p>
                </div>
              </div>
            )}
          </div>
            </>
          )}

          <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-900">Slutförda projekt</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Uppdrag som personal markerat som &quot;Slutfört projekt&quot; listas för det år då avslutet
                  registrerades.
                </p>
              </div>
              <div className="shrink-0">
                <label className="block text-xs text-gray-500 mb-1 md:text-right">År för projekt</label>
                <select
                  value={completedProjectsYear}
                  onChange={(e) => setCompletedProjectsYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md w-full md:min-w-[120px]"
                >
                  {yearOptions.map((year) => (
                    <option key={`proj-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {completedLoading ? (
              <p className="text-gray-600 py-6">Laddar projektstatistik…</p>
            ) : !completedProjects || completedProjects.completions.length === 0 ? (
              <p className="text-gray-500 italic">
                Inga slutförda projekt för {completedProjectsYear}. När personal trycker på &quot;Slutfört projekt&quot;
                visas posten här för det år avslutet registreras.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-6 mb-6 text-sm">
                  <p>
                    <span className="text-gray-600">Unika projekt med slutfört uppdrag under året:</span>{' '}
                    <span className="font-semibold text-gray-900">{completedProjects.uniqueProjectCount}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Antal registrerade slutföranden (personal):</span>{' '}
                    <span className="font-semibold" style={{ color: '#2D5016' }}>
                      {completedProjects.completionCount}
                    </span>
                  </p>
                </div>
                <p className="text-sm text-gray-600 mb-3">Klicka på en rad för att läsa uppgiftsbeskrivning och övriga detaljer.</p>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Projekt
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Kund
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Personal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Datum slutfört
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {completedProjects.completions.slice(0, completedVisibleCount).map((row) => (
                        <tr
                          key={row.projectEmployeeId}
                          className="hover:bg-emerald-50/60 cursor-pointer transition-colors"
                          onClick={() => setCompletedProjectDetail(row)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setCompletedProjectDetail(row)
                            }
                          }}
                        >
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-gray-900">{row.projectName}</p>
                            <p className="text-gray-500 text-xs">{row.projectAddress}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.customerName}</td>
                          <td className="px-4 py-3 text-sm text-gray-800">{row.employeeName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                            {row.completedAt
                              ? new Intl.DateTimeFormat('sv-SE', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }).format(new Date(row.completedAt))
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {completedProjects.completions.length > completedVisibleCount && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setCompletedVisibleCount((prev) => prev + COMPLETED_PROJECTS_PAGE_SIZE)}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800"
                    >
                      Visa fler
                    </button>
                  </div>
                )}
                {completedVisibleCount > COMPLETED_PROJECTS_PAGE_SIZE && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setCompletedVisibleCount(COMPLETED_PROJECTS_PAGE_SIZE)}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-800"
                    >
                      Visa mindre
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {completedProjectDetail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          aria-modal="true"
          role="dialog"
          onClick={() => setCompletedProjectDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{completedProjectDetail.projectName}</h3>
                <p className="text-sm text-gray-500 mt-1">{completedProjectDetail.customerName}</p>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md text-sm shrink-0"
                onClick={() => setCompletedProjectDetail(null)}
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adress</p>
                <p className="text-gray-900 mt-0.5">{completedProjectDetail.projectAddress}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Startdatum projekt</p>
                <p className="text-gray-900 mt-0.5">
                  {new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' }).format(
                    new Date(completedProjectDetail.projectStartDate)
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Vad som skulle göras / information
                </p>
                <p className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                  {completedProjectDetail.projectDescription?.trim()
                    ? completedProjectDetail.projectDescription
                    : 'Ingen beskrivning har lagts in för detta projekt.'}
                </p>
              </div>

              {completedProjectDetail.assignedEquipment?.trim() ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tilldelat fordon (denna personal)
                  </p>
                  <p className="text-gray-900 mt-0.5">{completedProjectDetail.assignedEquipment}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Personal som slutförde</p>
                  <p className="text-gray-900 mt-0.5">{completedProjectDetail.employeeName}</p>
                  <p className="text-gray-500 text-xs">{completedProjectDetail.employeeEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Markerat slutfört</p>
                  <p className="text-gray-900 mt-0.5 tabular-nums">
                    {completedProjectDetail.completedAt
                      ? new Intl.DateTimeFormat('sv-SE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(completedProjectDetail.completedAt))
                      : '—'}
                  </p>
                </div>
              </div>

              {completedProjectDetail.latitude != null &&
              completedProjectDetail.longitude != null &&
              !Number.isNaN(completedProjectDetail.latitude) &&
              !Number.isNaN(completedProjectDetail.longitude) ? (
                <div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${completedProjectDetail.latitude}&mlon=${completedProjectDetail.longitude}&zoom=16`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium"
                    style={{ color: '#2D5016' }}
                  >
                    Öppna plats på karta
                  </a>
                </div>
              ) : null}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-md text-white text-sm font-medium"
                style={{ backgroundColor: '#2D5016' }}
                onClick={() => setCompletedProjectDetail(null)}
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
