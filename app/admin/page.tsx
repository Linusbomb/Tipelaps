'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import SuccessDialog from '@/app/components/SuccessDialog'

interface TimeReport {
  id: string
  date: string
  totalHours: number
  status: string
  userId: string
  user: { id: string; name: string; email?: string }
  customer: { name: string }
}

type PeriodMode = 'month' | 'week'

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Mars',
  'April',
  'Maj',
  'Juni',
  'Juli',
  'Augusti',
  'September',
  'Oktober',
  'November',
  'December',
]

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function isoWeekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function weekRangeFromKey(weekKey: string) {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7)
  const nextMonday = new Date(monday)
  nextMonday.setUTCDate(monday.getUTCDate() + 7)
  return {
    startDate: monday.toISOString().slice(0, 10),
    endDate: nextMonday.toISOString().slice(0, 10),
  }
}

function groupReportsByEmployee(reports: TimeReport[]) {
  const groups = new Map<
    string,
    { userId: string; userName: string; reports: TimeReport[]; totalHours: number }
  >()
  for (const report of reports) {
    const key = report.user?.id || report.userId
    const existing =
      groups.get(key) ??
      {
        userId: key,
        userName: report.user?.name || 'Okänd anställd',
        reports: [],
        totalHours: 0,
      }
    existing.reports.push(report)
    existing.totalHours += Number(report.totalHours) || 0
    groups.set(key, existing)
  }
  return Array.from(groups.values()).sort((a, b) => a.userName.localeCompare(b.userName, 'sv'))
}

export default function AdminPage() {
  const [reports, setReports] = useState<TimeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('SUBMITTED')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey(new Date()))
  const [selectedWeek, setSelectedWeek] = useState(isoWeekKey(new Date()))
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({})
  const [approveAllConfirmOpen, setApproveAllConfirmOpen] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [approveAllSuccess, setApproveAllSuccess] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { role?: string }
        if (parsed.role !== 'ENTREPRENEUR' && parsed.role !== 'PAYROLL_COORDINATOR') {
          window.location.href = '/time-report'
          return
        }
      } catch {
        window.location.href = '/login'
        return
      }
    }
    fetchReports()
  }, [selectedStatus, periodMode, selectedMonth, selectedWeek])

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      if (!token) {
        window.location.href = '/login'
        return
      }
      if (userData) {
        const parsed = JSON.parse(userData)
        const isAdminUser = parsed.role === 'ENTREPRENEUR' || parsed.role === 'PAYROLL_COORDINATOR'
        if (!isAdminUser) {
          window.location.href = '/time-report'
          return
        }
      }

      const params = new URLSearchParams()
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus)
      if (periodMode === 'month') {
        params.append('month', selectedMonth)
      } else {
        const range = weekRangeFromKey(selectedWeek)
        if (range) {
          params.append('startDate', range.startDate)
          params.append('endDate', range.endDate)
        }
      }

      const response = await fetch(`/api/admin/time-reports?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Fel vid hämtning av rapporter:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Utkast'
      case 'SUBMITTED': return 'Att godkänna'
      case 'APPROVED': return 'Godkänd'
      default: return status
    }
  }

  const submittedReports = reports.filter((report) => report.status === 'SUBMITTED')
  const employeeGroups = groupReportsByEmployee(reports)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).reverse()
  const [selectedMonthYear, selectedMonthNumber] = selectedMonth.split('-')
  const [selectedWeekYear, selectedWeekNumber] = selectedWeek.split('-W')

  const toggleEmployee = (userId: string) => {
    setExpandedEmployees((prev) => ({ ...prev, [userId]: !prev[userId] }))
  }

  const approveAllSubmitted = async () => {
    if (submittedReports.length === 0) return

    try {
      setApprovingAll(true)
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/admin/time-reports/approve-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportIds: submittedReports.map((r) => r.id) }),
      })

      const data = await response.json().catch(() => ({} as { error?: string; count?: number }))
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte godkänna alla rapporter')
      }

      setApproveAllSuccess({
        title: 'Tidrapporter godkända',
        message: `${data.count ?? submittedReports.length} rapport${(data.count ?? submittedReports.length) === 1 ? '' : 'er'} har godkänts.`,
      })
      await fetchReports()
    } catch (error: any) {
      alert(error?.message || 'Kunde inte godkänna alla rapporter')
    } finally {
      setApprovingAll(false)
    }
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-6" style={{ color: '#2D5016' }}>
          Admin - Tidrapporter
        </h1>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="SUBMITTED">Att godkänna</option>
              <option value="DRAFT">Utkast</option>
              <option value="APPROVED">Godkända</option>
              <option value="ALL">Alla</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Period:</label>
            <select
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="month">Månadsvis</option>
              <option value="week">Veckovis</option>
            </select>
          </div>
          {periodMode === 'month' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-2">År:</label>
                <select
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonthNumber}`)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Månad:</label>
                <select
                  value={selectedMonthNumber}
                  onChange={(e) => setSelectedMonth(`${selectedMonthYear}-${e.target.value}`)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={String(index + 1).padStart(2, '0')}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-2">År:</label>
                <select
                  value={selectedWeekYear}
                  onChange={(e) => setSelectedWeek(`${e.target.value}-W${selectedWeekNumber}`)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vecka:</label>
                <select
                  value={selectedWeekNumber}
                  onChange={(e) => setSelectedWeek(`${selectedWeekYear}-W${e.target.value}`)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {Array.from({ length: 53 }, (_, index) => String(index + 1).padStart(2, '0')).map((week) => (
                    <option key={week} value={week}>
                      Vecka {Number(week)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <button
            type="button"
            className="w-full px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 lg:self-end"
            disabled={loading || approvingAll || submittedReports.length === 0}
            onClick={() => setApproveAllConfirmOpen(true)}
          >
            {approvingAll ? 'Godkänner...' : 'Godkänn alla'}
          </button>
        </div>

        {loading ? (
          <p>Laddar...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-500">Inga rapporter hittades.</p>
        ) : (
          <>
            <div className="space-y-5">
              {employeeGroups.map((group) => (
                <section
                  key={group.userId}
                  className="rounded-xl border border-gray-200 overflow-hidden bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleEmployee(group.userId)}
                    className="w-full px-4 py-3 bg-gray-50 text-left hover:bg-gray-100"
                    aria-expanded={Boolean(expandedEmployees[group.userId])}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
                          {group.userName}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {group.reports.length} rapport{group.reports.length === 1 ? '' : 'er'} ·{' '}
                          {group.totalHours.toFixed(1)} h totalt
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {expandedEmployees[group.userId] ? 'Dölj rapporter' : 'Visa rapporter'}
                      </span>
                    </div>
                  </button>

                  {expandedEmployees[group.userId] && (
                    <>
                      <div className="md:hidden divide-y divide-gray-100">
                        {group.reports.map((report) => (
                          <Link
                            key={report.id}
                            href={`/admin/time-reports/${report.id}`}
                            className="block p-4 hover:bg-gray-50"
                          >
                            <p className="text-sm font-semibold" style={{ color: '#2D5016' }}>
                              {new Date(report.date).toLocaleDateString('sv-SE')}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">{report.customer.name}</p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                              <span>{report.totalHours} h</span>
                              <span>{getStatusText(report.status)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>

                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kund</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timmar</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {group.reports.map((report) => (
                              <tr key={report.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <Link href={`/admin/time-reports/${report.id}`} className="underline" style={{ color: '#2D5016' }}>
                                    {new Date(report.date).toLocaleDateString('sv-SE')}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <Link href={`/admin/time-reports/${report.id}`} className="underline" style={{ color: '#2D5016' }}>
                                    {report.customer.name}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{report.totalHours} h</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusText(report.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={approveAllConfirmOpen}
        title="Godkänn alla"
        message="Är du säker att du vill godkänna alla?"
        confirmLabel="Ja, godkänn alla"
        onCancel={() => setApproveAllConfirmOpen(false)}
        onConfirm={() => {
          setApproveAllConfirmOpen(false)
          void approveAllSubmitted()
        }}
      />

      <SuccessDialog
        open={approveAllSuccess !== null}
        title={approveAllSuccess?.title ?? ''}
        message={approveAllSuccess?.message ?? ''}
        onClose={() => setApproveAllSuccess(null)}
      />
    </div>
  )
}