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
  user: { name: string }
  customer: { name: string }
}

export default function AdminPage() {
  const [reports, setReports] = useState<TimeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('SUBMITTED')
  const [approveAllConfirmOpen, setApproveAllConfirmOpen] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [approveAllSuccess, setApproveAllSuccess] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    fetchReports()
  }, [selectedStatus])

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
      case 'SUBMITTED': return 'Inlämnad'
      case 'APPROVED': return 'Godkänd'
      default: return status
    }
  }

  const submittedReports = reports.filter((report) => report.status === 'SUBMITTED')

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

        <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="SUBMITTED">Inlämnade</option>
              <option value="DRAFT">Utkast</option>
              <option value="APPROVED">Godkända</option>
              <option value="ALL">Alla</option>
            </select>
          </div>
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
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
            <div className="md:hidden space-y-3">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/time-reports/${report.id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold" style={{ color: '#2D5016' }}>
                    {report.user.name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">{report.customer.name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span>{new Date(report.date).toLocaleDateString('sv-SE')}</span>
                    <span>{report.totalHours} h</span>
                    <span>{getStatusText(report.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anställd</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kund</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timmar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link href={`/admin/time-reports/${report.id}`} className="underline" style={{ color: '#2D5016' }}>
                        {new Date(report.date).toLocaleDateString('sv-SE')}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link href={`/admin/time-reports/${report.id}`} className="underline" style={{ color: '#2D5016' }}>
                        {report.user.name}
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