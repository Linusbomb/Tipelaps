'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type MyReportRow = {
  id: string
  date: string
  month: string
  totalHours: number
  machineHours: number
  status: string
}

type MyHoursSummary = {
  totalHours: number
  totalMachineHours: number
  reportCount: number
}

const statusSv: Record<string, string> = {
  DRAFT: 'Utkast',
  SUBMITTED: 'Inlämnad',
  APPROVED: 'Godkänd',
}

function formatDatum(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('sv-SE')
  } catch {
    return iso
  }
}

export default function ProjectMyHoursPanel({
  projectId,
  showInfoText = true,
}: {
  projectId: string
  /** Dölj förklaringstext (t.ex. på avslutade projekt). */
  showInfoText?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<MyReportRow[]>([])
  const [summary, setSummary] = useState<MyHoursSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setError('Ingen session')
          return
        }
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/my-hours`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : 'Kunde inte hämta timmar')
          setReports([])
          setSummary(null)
          return
        }
        setReports(Array.isArray(data.reports) ? data.reports : [])
        setSummary(data?.summary && typeof data.summary === 'object' ? data.summary : null)
      } catch {
        if (!cancelled) {
          setError('Nätverksfel')
          setReports([])
          setSummary(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  return (
    <div className="mt-4 rounded-lg border border-green-200 bg-green-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-900 mb-2">
        Dina timmar på projektet
      </p>
      {showInfoText && (
        <p className="text-xs text-gray-600 mb-3">
          Endast tidrapporter du skapat och kopplat till detta projekt visas här — inte andra
          medarbetares timmar.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Laddar dina timmar…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-sm">
            <div>
              <p className="text-xs text-gray-600">Arbetade timmar</p>
              <p className="font-bold tabular-nums text-gray-900">{summary.totalHours.toFixed(1)} h</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Maskintimmar</p>
              <p className="font-bold tabular-nums text-gray-900">
                {summary.totalMachineHours.toFixed(1)} h
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Tidrapporter</p>
              <p className="font-bold tabular-nums text-gray-900">{summary.reportCount}</p>
            </div>
          </div>

          {reports.length === 0 ? (
            <p className="text-sm text-gray-600 italic">
              Inga tidrapporter kopplade till projektet ännu. Välj projektet när du skapar en
              tidrapport.
            </p>
          ) : (
            <ul className="divide-y divide-green-100 border border-green-200 rounded-md bg-white overflow-hidden">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/time-report/${r.id}`}
                    className="font-medium text-green-900 underline underline-offset-2 hover:text-green-950"
                  >
                    {formatDatum(r.date)}
                  </Link>
                  <span className="text-gray-600 shrink-0 tabular-nums">
                    {r.totalHours?.toFixed(1) ?? '0'} h
                    {r.machineHours > 0 ? ` · maskin ${r.machineHours.toFixed(1)} h` : ''} ·{' '}
                    {statusSv[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
