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

type AttachmentMeta = {
  id: string
  fileName: string
  mimeType?: string
  createdAt?: string
}

type ProjectMeta = {
  id: string
  name: string
  address?: string
  description?: string | null
  startDate?: string
  customerName?: string
  attachments?: AttachmentMeta[]
}

type ProjectHoursSummary = {
  totalHours: number
  totalMachineHours: number
  hoursApproved: number
  hoursSubmitted: number
  hoursDraft: number
  reportCount: number
  linkedToProjectCount: number
  byStatus: Record<string, number>
  byUser: Array<{
    userId: string
    name: string
    hours: number
    hoursApproved: number
    hoursSubmitted: number
    hoursDraft: number
    machineHours: number
    reportCount: number
    draftReportCount: number
  }>
  draftByUser: Array<{
    userId: string
    name: string
    hours: number
    reportCount: number
  }>
  latestCompletionAt: string | null
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

function isImageMime(mimeType?: string, fileName?: string) {
  if (mimeType?.startsWith('image/')) return true
  const lower = (fileName || '').toLowerCase()
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(lower)
}

function AuthenticatedAttachmentThumb({
  id,
  fileName,
  mimeType,
}: {
  id: string
  fileName: string
  mimeType?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function load() {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setFailed(true)
          return
        }
        const res = await fetch(`/api/project-attachments/${encodeURIComponent(id)}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          if (!cancelled) setFailed(true)
          return
        }
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setSrc(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    if (isImageMime(mimeType, fileName)) {
      load()
    } else {
      setFailed(true)
    }

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, fileName, mimeType])

  if (!isImageMime(mimeType, fileName)) {
    return (
      <a
        href={`/api/project-attachments/${encodeURIComponent(id)}/download`}
        className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 hover:bg-slate-50 min-h-[88px]"
        title={fileName}
      >
        <span className="font-medium text-slate-800 truncate max-w-full px-1">{fileName}</span>
        <span className="mt-1 text-slate-500">Öppna fil</span>
      </a>
    )
  }

  if (failed) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center min-h-[88px] text-xs text-slate-500 px-2 text-center">
        {fileName}
      </div>
    )
  }

  if (!src) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-100 animate-pulse min-h-[88px] min-w-[88px]" />
    )
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-slate-200 overflow-hidden bg-white hover:ring-2 hover:ring-emerald-600/40"
      title={fileName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={fileName} className="h-24 w-full object-cover sm:h-28 sm:w-36" />
    </a>
  )
}

export default function RelatedProjectTimeReportsPanel({
  projectId,
  fallbackAttachments,
  variant = 'default',
}: {
  projectId: string
  /** Bilder från projektlistan om API ännu inte laddats */
  fallbackAttachments?: AttachmentMeta[]
  /** Inbäddad i dashboard/statistik — utan extra yttre ram */
  variant?: 'default' | 'embedded'
}) {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [project, setProject] = useState<ProjectMeta | null>(null)
  const [summary, setSummary] = useState<ProjectHoursSummary | null>(null)
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
        setProject(data?.project && typeof data.project === 'object' ? data.project : null)
        setSummary(data?.summary && typeof data.summary === 'object' ? data.summary : null)
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

  const attachments =
    (project?.attachments?.length ? project.attachments : fallbackAttachments) ?? []

  const shellClass =
    variant === 'embedded'
      ? 'mt-3 pt-3 border-t border-gray-200'
      : 'rounded-lg border border-slate-200 bg-slate-50/90 p-4 mt-3'

  return (
    <div className={shellClass}>
      <p className="text-sm font-semibold text-slate-900 mb-1">Arbetade timmar på projektet</p>
      <p className="text-xs text-slate-600 mb-3">
        Godkända och utkast enligt matchade tidrapporter (projektkoppling samt kund, personal och
        period). Poster utan projektkoppling kan tillhöra annat uppdrag mot samma kund.
      </p>

      {project && !loading && (
        <div className="mb-4 rounded-md border border-white bg-white p-3 text-sm text-gray-800 shadow-sm">
          <p className="font-semibold text-gray-900 text-base">{project.name}</p>
          {project.customerName ? (
            <p className="text-gray-600 mt-0.5">
              <span className="text-gray-500">Kund:</span> {project.customerName}
            </p>
          ) : null}
          {project.address ? (
            <p className="text-gray-600">
              <span className="text-gray-500">Adress:</span> {project.address}
            </p>
          ) : null}
          {project.startDate ? (
            <p className="text-gray-600">
              <span className="text-gray-500">Start:</span> {formatDatum(project.startDate)}
            </p>
          ) : null}
          {project.description?.trim() ? (
            <p className="mt-2 text-gray-800 whitespace-pre-wrap border-t border-gray-100 pt-2">
              {project.description}
            </p>
          ) : null}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
            Projektbilder ({attachments.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AuthenticatedAttachmentThumb
                key={att.id}
                id={att.id}
                fileName={att.fileName}
                mimeType={att.mimeType}
              />
            ))}
          </div>
        </div>
      )}

      {summary && !loading && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-900">Godkända timmar</p>
              <p className="text-lg font-bold tabular-nums text-emerald-950">
                {(summary.hoursApproved ?? 0).toFixed(1)} h
              </p>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-900">Inskickade (väntar)</p>
              <p className="text-lg font-bold tabular-nums text-blue-950">
                {(summary.hoursSubmitted ?? 0).toFixed(1)} h
              </p>
            </div>
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-900">Utkast</p>
              <p className="text-lg font-bold tabular-nums text-amber-950">
                {(summary.hoursDraft ?? 0).toFixed(1)} h
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-600">Totalt rapporterat</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">
                {summary.totalHours.toFixed(1)} h
              </p>
              {(summary.totalMachineHours ?? 0) > 0 ? (
                <p className="text-xs text-slate-500 tabular-nums">
                  varav maskin {summary.totalMachineHours.toFixed(1)} h
                </p>
              ) : null}
            </div>
          </div>

          {(summary.draftByUser?.length ?? 0) > 0 && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50/90 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-950 mb-1.5">Kvar i utkast</p>
              <ul className="text-sm space-y-1">
                {summary.draftByUser.map((row) => (
                  <li key={row.userId} className="flex justify-between gap-2 text-amber-950">
                    <span className="font-medium">{row.name}</span>
                    <span className="tabular-nums shrink-0 text-right">
                      {row.hours.toFixed(1)} h · {row.reportCount}{' '}
                      {row.reportCount === 1 ? 'rapport' : 'rapporter'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.byUser.length > 0 && (
            <div className="mb-3 rounded-md border border-emerald-200/80 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 mb-2">
                Timmar per person
              </p>
              <ul className="text-sm space-y-2">
                {summary.byUser.map((row) => (
                  <li key={row.userId} className="border-b border-emerald-200/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between gap-2 font-medium text-gray-900">
                      <span>{row.name}</span>
                      <span className="tabular-nums shrink-0">{row.hours.toFixed(1)} h totalt</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 tabular-nums">
                      Godkänt {row.hoursApproved.toFixed(1)} h
                      {row.hoursSubmitted > 0 ? ` · Inskickat ${row.hoursSubmitted.toFixed(1)} h` : ''}
                      {row.hoursDraft > 0 ? (
                        <span className="text-amber-800 font-medium">
                          {' '}
                          · Utkast {row.hoursDraft.toFixed(1)} h ({row.draftReportCount} st)
                        </span>
                      ) : null}
                      {(row.machineHours ?? 0) > 0
                        ? ` · Maskin ${row.machineHours.toFixed(1)} h`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-500 mb-2">
            {summary.reportCount} rapporter · {summary.linkedToProjectCount} direkt kopplade till
            projektet
            {summary.latestCompletionAt
              ? ` · Senast slutfört ${formatDatum(summary.latestCompletionAt)}`
              : ''}
          </p>
        </>
      )}

      {hint && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-2">
          {hint}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5 mb-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Laddar tidrapporter…</p>
      ) : reports.length === 0 && !hint && !error ? (
        <p className="text-sm text-slate-600 italic">Inga matchande tidrapporter i perioden.</p>
      ) : reports.length > 0 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5 mt-1">
            Alla matchande rapporter
          </p>
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white overflow-hidden">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2 text-sm hover:bg-slate-50/80"
              >
                <Link
                  href={`/admin/time-reports/${r.id}`}
                  className="font-medium text-green-900 underline underline-offset-2 hover:text-green-950"
                >
                  {formatDatum(r.date)} — {r.user.name}
                </Link>
                <span className="shrink-0">
                  <span
                    className={
                      r.status === 'DRAFT'
                        ? 'text-amber-800 font-medium'
                        : r.status === 'APPROVED'
                          ? 'text-emerald-800'
                          : 'text-slate-600'
                    }
                  >
                    {statusSv[r.status] ?? r.status}
                  </span>
                  <span className="text-slate-600">
                    {' '}
                    · {r.totalHours?.toFixed(1) ?? '0'} h ·{' '}
                    <span className="text-slate-500">{r.month}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
