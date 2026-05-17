'use client'

import Link from 'next/link'

export type MonthReportRow = {
  id: string
  date: string
  totalHours: number
  status: string
  customer?: { id: string; name: string } | null
}

export type CustomerReportGroup = {
  key: string
  customerId: string
  customerName: string
  reports: MonthReportRow[]
  totalHours: number
  draftCount: number
  submittedCount: number
}

export function groupReportsByCustomer(reports: MonthReportRow[]): CustomerReportGroup[] {
  return reports.reduce<CustomerReportGroup[]>((acc, report) => {
    const customerId = report.customer?.id || 'unknown'
    const existing = acc.find((g) => g.key === customerId)

    if (existing) {
      existing.reports.push(report)
      existing.totalHours += report.totalHours || 0
      if (report.status === 'DRAFT') existing.draftCount += 1
      if (report.status === 'SUBMITTED' || report.status === 'APPROVED') {
        existing.submittedCount += 1
      }
    } else {
      acc.push({
        key: customerId,
        customerId,
        customerName: report.customer?.name || 'Okänd kund',
        reports: [report],
        totalHours: report.totalHours || 0,
        draftCount: report.status === 'DRAFT' ? 1 : 0,
        submittedCount:
          report.status === 'SUBMITTED' || report.status === 'APPROVED' ? 1 : 0,
      })
    }

    return acc
  }, [])
}

function statusLabel(status: string) {
  if (status === 'SUBMITTED' || status === 'APPROVED') return 'Inskickat'
  return 'Utkast'
}

type MonthCustomerReportFoldersProps = {
  groups: CustomerReportGroup[]
  totalDraftCount: number
  submitting?: boolean
  submittingCustomerId?: string | null
  onSubmitAll: () => void
  onSubmitCustomer: (customerId: string, customerName: string) => void
  onDeleteReport?: (report: { id: string; date: string; customerName: string }) => void
  deletingReportId?: string | null
}

export default function MonthCustomerReportFolders({
  groups,
  totalDraftCount,
  submitting = false,
  submittingCustomerId = null,
  onSubmitAll,
  onSubmitCustomer,
  onDeleteReport,
  deletingReportId = null,
}: MonthCustomerReportFoldersProps) {
  if (groups.length === 0) {
    return <p className="text-gray-500 mb-4">Inga tidrapporter för denna månad ännu.</p>
  }

  return (
    <div className="space-y-4 mb-6">
      {groups.map((group) => {
        const allSubmitted = group.draftCount === 0 && group.reports.length > 0
        const isSubmittingCustomer = submitting && submittingCustomerId === group.customerId

        return (
          <div
            key={group.key}
            className="rounded-xl border-2 overflow-hidden bg-white shadow-sm"
            style={{ borderColor: 'rgba(45, 80, 22, 0.22)' }}
          >
            <div
              className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              style={{ background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)' }}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: '#2D5016' }}>
                  {group.customerName}
                </h3>
                <p className="text-sm text-gray-700 mt-0.5">
                  {group.reports.length} tidrapport{group.reports.length === 1 ? '' : 'er'} ·{' '}
                  {group.totalHours.toFixed(1)} timmar totalt
                  {allSubmitted ? ' · Alla inskickade' : group.draftCount > 0 ? ` · ${group.draftCount} utkast` : ''}
                </p>
              </div>
              {group.draftCount > 0 && group.customerId !== 'unknown' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => onSubmitCustomer(group.customerId, group.customerName)}
                  className="shrink-0 px-4 py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#2D5016' }}
                >
                  {isSubmittingCustomer
                    ? 'Skickar...'
                    : `Skicka ${group.customerName} (${group.draftCount})`}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Datum
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Timmar
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Åtgärd
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.reports
                    .slice()
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-2 text-sm">
                          {new Date(report.date).toLocaleDateString('sv-SE')}
                        </td>
                        <td className="px-4 py-2 text-sm">{report.totalHours?.toFixed(1)} h</td>
                        <td className="px-4 py-2 text-sm">{statusLabel(report.status)}</td>
                        <td className="px-4 py-2 text-sm space-x-3">
                          <Link
                            href={`/time-report/${report.id}`}
                            className="font-medium text-green-800 underline underline-offset-2 hover:text-green-950"
                          >
                            {report.status === 'DRAFT' ? 'Redigera' : 'Visa'}
                          </Link>
                          {report.status === 'DRAFT' && onDeleteReport && (
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteReport({
                                  id: report.id,
                                  date: report.date,
                                  customerName: group.customerName,
                                })
                              }
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
        )
      })}

      {totalDraftCount > 0 && (
        <div className="pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onSubmitAll}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {submitting && !submittingCustomerId
              ? 'Skickar alla...'
              : `Skicka alla tidrapporter (${totalDraftCount})`}
          </button>
        </div>
      )}
    </div>
  )
}
