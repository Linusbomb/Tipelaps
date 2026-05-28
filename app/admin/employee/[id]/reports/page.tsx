'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import UnlockTimeReportingButton from '@/app/components/UnlockTimeReportingButton'

export default function EmployeeReportsPage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params?.id as string
  const [user, setUser] = useState<any>(null)
  const [employee, setEmployee] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'ENTREPRENEUR' && parsedUser.role !== 'PAYROLL_COORDINATOR') {
      router.push('/time-report')
      return
    }

    setUser(parsedUser)
    fetchData()
  }, [router, employeeId, selectedMonth])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      
      const [employeeRes, reportsRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/admin/time-reports?employeeId=${employeeId}&month=${selectedMonth}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])

      if (employeeRes.ok) {
        const employeeData = await employeeRes.json()
        setEmployee(employeeData)
      } else {
        const errorData = await employeeRes.json()
        setError(errorData.error || 'Kunde inte hämta personal')
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json()
        setReports(reportsData)
      } else {
        const errorData = await reportsRes.json()
        setError(errorData.error || 'Kunde inte hämta tidrapporter')
      }
    } catch (err) {
      console.error('Kunde inte hämta data:', err)
      setError('Ett fel uppstod vid hämtning av data')
    } finally {
      setLoading(false)
    }
  }

  const getReportsByStatus = (status: string) => {
    return reports.filter((r: any) => r.status === status)
  }

  const getTotalHours = (reports: any[]) => {
    return reports.reduce((sum, r) => sum + (r.totalHours || 0), 0)
  }

  if (loading) {
    return <div className="app-shell-wide">Laddar...</div>
  }

  if (error && !employee) {
    return (
      <div className="app-shell-wide">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      </div>
    )
  }

  const draftReports = getReportsByStatus('DRAFT')
  const submittedReports = getReportsByStatus('SUBMITTED')
  const approvedReports = getReportsByStatus('APPROVED')

  return (
    <div className="app-shell-wide">
      <div className="mb-8">
        <button
          onClick={() => router.push('/admin/contact')}
          className="text-primary-600 hover:text-primary-900 mb-4 flex items-center"
        >
          ← Tillbaka till Kontakt
        </button>
        <div className="flex items-center space-x-4 mb-4">
          {employee?.profileImagePath ? (
            <img
              src={`/api/users/${employee.id}/profile-image`}
              alt={employee.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center font-semibold text-gray-600 text-xl">
              {employee?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{employee?.name}</h1>
            <p className="text-gray-600">{employee?.email}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Välj månad
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        {(submittedReports.length > 0 || approvedReports.length > 0) && employeeId && (
          <UnlockTimeReportingButton
            userId={employeeId}
            month={selectedMonth}
            label="Lås upp månaden för komplettering"
            onUnlocked={fetchData}
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">I buffert (utkast)</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{draftReports.length}</p>
          <p className="text-sm text-gray-600 mt-1">{getTotalHours(draftReports).toFixed(1)} timmar</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Skickade in</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{submittedReports.length}</p>
          <p className="text-sm text-gray-600 mt-1">{getTotalHours(submittedReports).toFixed(1)} timmar</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Godkända</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{approvedReports.length}</p>
          <p className="text-sm text-gray-600 mt-1">{getTotalHours(approvedReports).toFixed(1)} timmar</p>
        </div>
      </div>

      <div className="space-y-6">
        {reports.length > 0 && (
          <h2 className="text-xl font-bold text-gray-900" style={{ color: '#2D5016' }}>
            Arbetade timmar
          </h2>
        )}

        {draftReports.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-orange-600">
              I buffert ({draftReports.length})
            </h2>
            <div className="space-y-4">
              {draftReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        )}

        {submittedReports.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-green-600">
              Skickade in ({submittedReports.length})
            </h2>
            <div className="space-y-4">
              {submittedReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  employeeId={employeeId}
                  onUnlocked={fetchData}
                />
              ))}
            </div>
          </div>
        )}

        {approvedReports.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              Godkända ({approvedReports.length})
            </h2>
            <div className="space-y-4">
              {approvedReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  employeeId={employeeId}
                  onUnlocked={fetchData}
                />
              ))}
            </div>
          </div>
        )}

        {reports.length === 0 && (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500">Inga tidrapporter för denna månad.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportCard({
  report,
  employeeId,
  onUnlocked,
}: {
  report: any
  employeeId?: string
  onUnlocked?: () => void
}) {
  const reportDate = format(new Date(report.date), 'd MMMM yyyy', { locale: sv })
  const totalHours = report.entries.reduce((sum: number, entry: any) => sum + entry.hours, 0)
  const totalMachineHours = report.entries.reduce(
    (sum: number, entry: any) =>
      sum + (entry.machineHours && entry.machineHours > 0 ? Number(entry.machineHours) : 0),
    0
  )
  const otherHours = Math.max(0, totalHours - totalMachineHours)

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {report.project?.name?.trim() || 'Inget projekt'}
          </h3>
          {report.customer?.name ? (
            <p className="text-xs text-gray-500 mt-0.5">{report.customer.name}</p>
          ) : null}
          <p className="text-sm text-gray-600 mt-1">Datum: {reportDate}</p>
          <p className="text-sm text-gray-600">Totalt: {totalHours.toFixed(1)} timmar</p>
          {otherHours > 0 && (
            <p className="text-sm text-gray-600">Övrig tid (ej fordonstimmar): {otherHours.toFixed(1)} timmar</p>
          )}
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            report.status === 'DRAFT' ? 'bg-orange-100 text-orange-800' :
            report.status === 'SUBMITTED' ? 'bg-green-100 text-green-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {report.status === 'DRAFT' ? 'I buffert' :
             report.status === 'SUBMITTED' ? 'Skickad' :
             'Godkänd'}
          </span>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Aktiviteter:</h4>
        <div className="space-y-2">
          {report.entries.map((entry: any, index: number) => (
            <div key={index} className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                    {entry.vehicle && <span>🚗 {entry.vehicle}</span>}
                    {entry.location && <span>📍 {entry.location}</span>}
                    {entry.referenceNumber && <span>🔢 {entry.referenceNumber}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-primary-600 ml-4">
                  {entry.hours.toFixed(1)}h
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {report.missingHoursReason && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Förklaring av övrig tid:</h4>
          <p className="text-sm text-gray-600 whitespace-pre-line">{report.missingHoursReason}</p>
        </div>
      )}

      {employeeId &&
        (report.status === 'SUBMITTED' || report.status === 'APPROVED') && (
          <div className="border-t pt-4 mt-4">
            <UnlockTimeReportingButton
              userId={employeeId}
              reportIds={[report.id]}
              label="Lås upp denna rapport"
              onUnlocked={onUnlocked}
            />
          </div>
        )}
    </div>
  )
}
