'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ReportRow = {
  id: string
  date: string
  month: string
  totalHours: number
  status: string
  user: { id: string; name: string }
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

export default function RelatedProjectTimeReportsPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setHint(null)
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setError('Ingen session')
          return
        }
        const res = await fetch(
          `/api/admin/projects/${encodeURIComponent(projectId)}/related-time-reports`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : 'Kunde inte hämta lista')
          setReports([])
          return
        }
        if (typeof data?.hint === 'string') {
          setHint(data.hint)
        }
        setReports(Array.isArray(data.reports) ? data.reports : [])
      } catch {
        if (!cancelled) {
          setError('Nätverksfel')
          setReports([])
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
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
        Genväg — tidrapporter kopplade till projektet
      </p>
      <p className="text-xs text-slate-600 mb-3">
        Lista baseras på samma kund, tilldelad personal på projektet och rapportdatum mellan projektstart och
        en period efter att projekt markerats slutfört. Vid flera uppdrag mot samma kund kan även poster till
        annat uppdrag synas om de ligger i samma tidsspann.
      </p>

      {hint && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-2">{hint}</p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-2">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Laddar tidrapporter…</p>
      ) : reports.length === 0 && !hint && !error ? (
        <p className="text-sm text-slate-600 italic">Inga matchande tidrapporter i perioden.</p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white overflow-hidden">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2 text-sm hover:bg-slate-50/80">
              <Link
                href={`/admin/time-reports/${r.id}`}
                className="font-medium text-green-900 underline underline-offset-2 hover:text-green-950"
              >
                {formatDatum(r.date)} — {r.user.name}
              </Link>
              <span className="text-slate-600 shrink-0">
                {r.totalHours?.toFixed(1) ?? '0'} h · {statusSv[r.status] ?? r.status} ·{' '}
                <span className="text-slate-500">{r.month}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
