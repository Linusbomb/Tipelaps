'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SuccessDialog from '@/app/components/SuccessDialog'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import MonthCustomerReportFolders, {
  groupReportsByCustomer,
} from '@/app/components/MonthCustomerReportFolders'

function formatMonthYearSv(monthKey: string) {
  const raw = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('sv-SE', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function buildRecentMonthOptions(count: number) {
  const options: string[] = []
  const now = new Date()
  const baseDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const minAllowedDate = new Date(2026, 0, 1) // Januari 2026

  for (let i = 0; i < count; i += 1) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1)
    if (d < minAllowedDate) {
      break
    }
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push(month)
  }

  return options
}

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
  entries: Array<{
    id: string
    hours: number
    description: string
    machineHours?: number
  }>
}

export default function MyReportsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [reports, setReports] = useState<TimeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedMonth, setSelectedMonth] = useState('ALL')
  const [submitSuccess, setSubmitSuccess] = useState<{ title: string; message: string } | null>(null)
  const [submitConfirm, setSubmitConfirm] = useState<
    | { scope: 'all'; month: string; count: number }
    | { scope: 'customer'; month: string; customerId: string; customerName: string; count: number }
    | null
  >(null)
  const [submittingMonth, setSubmittingMonth] = useState(false)
  const [submittingCustomerId, setSubmittingCustomerId] = useState<string | null>(null)
  const [reportToDelete, setReportToDelete] = useState<TimeReport | null>(null)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const monthOptions = buildRecentMonthOptions(24)

  useEffect(() => {
    fetchReports()
  }, [selectedStatus, selectedMonth])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus)
      }
      if (selectedMonth !== 'ALL') {
        params.append('month', selectedMonth)
      }

      const response = await fetch(`/api/time-reports?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        router.push('/login')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-200 text-gray-800'
      case 'SUBMITTED':
        return 'bg-yellow-200 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-200 text-green-800'
      default:
        return 'bg-gray-200 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Utkast'
      case 'SUBMITTED':
        return 'Inlämnad'
      case 'APPROVED':
        return 'Godkänd'
      default:
        return status
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
      fetchReports()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte ta bort tidrapporten')
    } finally {
      setDeletingReportId(null)
    }
  }

  const submitMonth = async (month: string, customerId?: string) => {
    try {
      setSubmittingMonth(true)
      if (customerId) setSubmittingCustomerId(customerId)

      const token = localStorage.getItem('token')
      const response = await fetch(`/api/time-reports/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month,
          ...(customerId ? { customerId } : {}),
        }),
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({} as { message?: string }))
        setSubmitSuccess({
          title: 'Tidrapporter inskickade',
          message:
            data.message ||
            'Tidrapporterna har skickats till administratören för granskning.',
        })
        fetchReports()
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

  const monthGroupedReports =
    selectedMonth !== 'ALL' ? groupReportsByCustomer(reports) : []
  const monthDraftCount =
    selectedMonth !== 'ALL'
      ? reports.filter((r) => r.status === 'DRAFT').length
      : 0

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
              <option value="ALL">Alla</option>
              <option value="DRAFT">Utkast</option>
              <option value="SUBMITTED">Inlämnade</option>
              <option value="APPROVED">Godkända</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Filtrera efter månad:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="ALL">Alla månader</option>
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
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {selectedMonth !== 'ALL'
                ? `Inga rapporter hittades för ${formatMonthYearSv(selectedMonth)}.`
                : 'Inga rapporter hittades.'}
            </p>
            <Link
              href="/time-report"
              className="mt-4 inline-block px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Skapa din första rapport
            </Link>
          </div>
        ) : selectedMonth !== 'ALL' ? (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Tidrapporterna för {formatMonthYearSv(selectedMonth)} är sorterade per kund. Skicka en
              kundmapp i taget, eller alla utkast på en gång.
            </p>
            <MonthCustomerReportFolders
              groups={monthGroupedReports}
              totalDraftCount={monthDraftCount}
              submitting={submittingMonth}
              submittingCustomerId={submittingCustomerId}
              onSubmitAll={() =>
                setSubmitConfirm({ scope: 'all', month: selectedMonth, count: monthDraftCount })
              }
              onSubmitCustomer={(customerId, customerName) => {
                const count =
                  monthGroupedReports.find((g) => g.customerId === customerId)?.draftCount ?? 0
                setSubmitConfirm({
                  scope: 'customer',
                  month: selectedMonth,
                  customerId,
                  customerName,
                  count,
                })
              }}
              onDeleteReport={(r) => {
                const full = reports.find((rep) => rep.id === r.id)
                if (full) setReportToDelete(full)
              }}
              deletingReportId={deletingReportId}
            />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Välj en månad ovan för att se kundmappar och skicka in tidrapporter.
            </p>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kund</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timmar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(report.date).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {report.customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {report.totalHours} h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(report.status)}`}>
                        {getStatusText(report.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <Link
                        href={`/time-report/${report.id}`}
                        className="text-green-600 hover:text-green-800 underline font-medium"
                      >
                        {report.status === 'DRAFT' ? 'Redigera' : 'Visa'}
                      </Link>
                      {report.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => setReportToDelete(report)}
                          disabled={deletingReportId === report.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingReportId === report.id ? 'Tar bort...' : 'Ta bort'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {reports.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Totalt antal rapporter</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Totalt antal timmar</p>
                <p className="text-2xl font-bold">
                  {reports.reduce((sum, r) => sum + r.totalHours, 0).toFixed(1)} h
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Utkast</p>
                <p className="text-2xl font-bold">
                  {reports.filter(r => r.status === 'DRAFT').length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={reportToDelete !== null}
        title="Ta bort tidrapport?"
        message={
          reportToDelete
            ? `Vill du ta bort tidrapporten för ${reportToDelete.customer.name} den ${new Date(reportToDelete.date).toLocaleDateString('sv-SE')}? Detta går inte att ångra.`
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
          submitConfirm?.scope === 'customer'
            ? `Skicka ${submitConfirm.customerName}?`
            : 'Skicka alla tidrapporter?'
        }
        message={
          submitConfirm
            ? submitConfirm.scope === 'customer'
              ? `Du skickar in ${submitConfirm.count} utkast för ${submitConfirm.customerName} (${formatMonthYearSv(submitConfirm.month)}). Fortsätta?`
              : `Du skickar in alla ${submitConfirm.count} utkast för ${formatMonthYearSv(submitConfirm.month)}. Fortsätta?`
            : ''
        }
        confirmLabel="Ja, skicka in"
        onCancel={() => setSubmitConfirm(null)}
        onConfirm={() => {
          if (!submitConfirm) return
          const pending = submitConfirm
          setSubmitConfirm(null)
          if (pending.scope === 'customer') {
            void submitMonth(pending.month, pending.customerId)
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