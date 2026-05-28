'use client'

import Link from 'next/link'
export type MonthReportRow = {
  id: string
  date: string
  totalHours: number
  status: string
  customer?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
  _count?: { attachments?: number }
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

/** En sektion «Arbetade timmar» med alla rapporter (t.ex. Mina rapporter). */
export function groupReportsAsWorkHoursSection(reports: MonthReportRow[]): CustomerReportGroup[] {
  if (reports.length === 0) return []

  const draftCount = reports.filter((r) => r.status === 'DRAFT').length
  const submittedCount = reports.filter(
    (r) => r.status === 'SUBMITTED' || r.status === 'APPROVED'
  ).length

  return [
    {
      key: 'work-hours',
      customerId: 'work-hours',
      customerName: 'Arbetade timmar',
      reports: reports.slice(),
      totalHours: reports.reduce((sum, r) => sum + (r.totalHours || 0), 0),
      draftCount,
      submittedCount,
    },
  ]
}

export function monthReportStatusLabel(status: string) {
  if (status === 'APPROVED') return 'Godkänd'
  if (status === 'SUBMITTED') return 'Inskickad till admin'
  return 'Utkast'
}

export function monthReportStatusBadgeClass(status: string) {
  if (status === 'APPROVED') return 'bg-green-100 text-green-900'
  if (status === 'SUBMITTED') return 'bg-amber-100 text-amber-950'
  return 'bg-gray-100 text-gray-800'
}

export function isMonthReportDraft(status: string) {
  return status === 'DRAFT'
}

type MonthCustomerReportFoldersProps = {
  groups: CustomerReportGroup[]
  totalDraftCount: number
  selectedReportIds: Set<string>
  onToggleReport: (reportId: string) => void
  onToggleCustomerDrafts: (customerId: string, draftIds: string[], checked: boolean) => void
  onSelectAllDrafts: () => void
  onClearSelection: () => void
  onSubmitSelected: () => void
  onSubmitAllDrafts: () => void
  submitting?: boolean
  submittingCustomerId?: string | null
  onDeleteReport?: (report: {
    id: string
    date: string
    customerName: string
    projectName?: string
  }) => void
  deletingReportId?: string | null
  /** Visa projektnamn per rad (Mina rapporter). */
  showProjectColumn?: boolean
  /** Text när gruppen har rubrik men inga rader (t.ex. tomt statusfilter). */
  emptyListMessage?: string
  /** Visa kryssrutor för alla rader (t.ex. sidan Tidrapporter & inlämning). */
  enableDraftSelection?: boolean
}

export default function MonthCustomerReportFolders({
  groups,
  totalDraftCount,
  selectedReportIds,
  onToggleReport,
  onToggleCustomerDrafts,
  onSelectAllDrafts,
  onClearSelection,
  onSubmitSelected,
  onSubmitAllDrafts,
  submitting = false,
  submittingCustomerId = null,
  onDeleteReport,
  deletingReportId = null,
  showProjectColumn = false,
  emptyListMessage,
  enableDraftSelection = false,
}: MonthCustomerReportFoldersProps) {
  const selectedCount = selectedReportIds.size

  if (groups.length === 0 && totalDraftCount === 0) {
    return (
      <div className="mb-6">
        <p className="text-gray-500 mb-4">Inga tidrapporter för denna månad ännu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-6">
      {totalDraftCount > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold" style={{ color: '#2D5016' }}>
              Skicka till admin
            </span>
            <span className="block text-xs text-gray-600 mt-0.5">
              Kryssa i utkast du vill skicka. Redan inskickade kan inte väljas om.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAllDrafts}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              Markera alla utkast
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                Avmarkera
              </button>
            )}
            <button
              type="button"
              disabled={submitting || selectedCount === 0}
              onClick={onSubmitSelected}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {submitting && !submittingCustomerId
                ? 'Skickar...'
                : `Skicka valda till admin (${selectedCount})`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmitAllDrafts}
              className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting && !submittingCustomerId
                ? 'Skickar...'
                : `Skicka alla utkast (${totalDraftCount})`}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && totalDraftCount > 0 ? (
        <p className="text-sm text-gray-600 px-1">
          Inga tidrapporter-utkast denna månad. Frånvaroutkast skickas med «Skicka alla utkast».
        </p>
      ) : null}

      {groups.map((group) => {
        const allSubmitted = group.draftCount === 0 && group.reports.length > 0
        const draftReports = group.reports.filter((r) => isMonthReportDraft(r.status))
        const draftIds = draftReports.map((r) => r.id)
        const selectedInGroup = draftIds.filter((id) => selectedReportIds.has(id)).length
        const allDraftsInGroupSelected =
          draftIds.length > 0 && selectedInGroup === draftIds.length
        const showCheckboxes =
          enableDraftSelection || group.draftCount > 0

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
                  {allSubmitted
                    ? ' · Alla inskickade'
                    : group.draftCount > 0 && group.submittedCount > 0
                      ? ` · ${group.draftCount} utkast · ${group.submittedCount} inskickade`
                      : group.draftCount > 0
                        ? ` · ${group.draftCount} utkast`
                        : group.submittedCount > 0
                          ? ` · ${group.submittedCount} inskickade`
                          : ''}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {showCheckboxes && (
                      <th className="px-3 py-2 text-left w-10">
                        <input
                          type="checkbox"
                          checked={allDraftsInGroupSelected}
                          disabled={draftIds.length === 0}
                          onChange={(e) =>
                            onToggleCustomerDrafts(group.customerId, draftIds, e.target.checked)
                          }
                          title="Markera alla utkast"
                          className="h-4 w-4"
                        />
                      </th>
                    )}
                    {showProjectColumn && (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Projekt
                      </th>
                    )}
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
                      Bilaga
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Åtgärd
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.reports.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          (showCheckboxes ? 1 : 0) +
                          (showProjectColumn ? 1 : 0) +
                          5
                        }
                        className="px-4 py-6 text-sm text-gray-500 text-center"
                      >
                        {emptyListMessage || 'Inga tidrapporter.'}
                      </td>
                    </tr>
                  ) : null}
                  {group.reports
                    .slice()
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((report) => {
                      const draft = isMonthReportDraft(report.status)
                      const selected = selectedReportIds.has(report.id)
                      return (
                        <tr
                          key={report.id}
                          className={`hover:bg-gray-50/80 ${!draft ? 'bg-gray-50/40' : ''}`}
                        >
                          {showCheckboxes && (
                            <td className="px-3 py-2">
                              {draft ? (
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => onToggleReport(report.id)}
                                  className="h-4 w-4"
                                  aria-label={`Skicka rapport ${new Date(report.date).toLocaleDateString('sv-SE')}`}
                                />
                              ) : (
                                <span className="text-gray-300 text-xs" title="Redan inskickad">
                                  —
                                </span>
                              )}
                            </td>
                          )}
                          {showProjectColumn && (
                            <td className="px-4 py-2 text-sm">
                              <span className="font-semibold text-gray-900">
                                {report.project?.name?.trim() || 'Inget projekt'}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2 text-sm">
                            {new Date(report.date).toLocaleDateString('sv-SE')}
                          </td>
                          <td className="px-4 py-2 text-sm">{report.totalHours?.toFixed(1)} h</td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${monthReportStatusBadgeClass(report.status)}`}
                            >
                              {monthReportStatusLabel(report.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {(report._count?.attachments || 0) > 0
                              ? `${report._count?.attachments} st`
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-sm space-x-3">
                            <Link
                              href={`/time-report/${report.id}`}
                              className="font-medium text-green-800 underline underline-offset-2 hover:text-green-950"
                            >
                              {draft ? 'Redigera' : 'Visa'}
                            </Link>
                            {draft && onDeleteReport && (
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteReport({
                                    id: report.id,
                                    date: report.date,
                                    customerName: report.customer?.name || group.customerName,
                                    projectName: report.project?.name,
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
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
