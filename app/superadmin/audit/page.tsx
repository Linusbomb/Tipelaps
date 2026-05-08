'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'
const PAGE_SIZE = 50

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

type AuditRow = {
  id: string
  createdAt: string
  action: string
  actorId: string | null
  actorEmail: string | null
  actorRole: string | null
  targetType: string | null
  targetId: string | null
  companyId: string | null
  ipAddress: string | null
  userAgent: string | null
  details: any
}

type ListResponse = {
  rows: AuditRow[]
  total: number
  limit: number
  offset: number
  actions: string[]
}

export default function SuperAdminAuditPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    action: '',
    actorEmail: '',
    companyId: '',
    ipAddress: '',
    since: '',
    until: '',
  })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [data, setData] = useState<ListResponse | null>(null)
  const [page, setPage] = useState(0)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('token')
    const u = localStorage.getItem('user')
    if (!t || !u) {
      window.location.href = '/login?type=admin'
      return
    }
    try {
      const parsed: SessionUser = JSON.parse(u)
      if (parsed.role !== 'SUPERADMIN') {
        window.location.href = '/admin'
        return
      }
      setUser(parsed)
      setToken(t)
    } catch {
      window.location.href = '/login?type=admin'
      return
    } finally {
      setLoading(false)
    }
  }, [])

  const load = useCallback(
    async (opts: { offset: number; filters: typeof filters }) => {
      if (!token) return
      setFetching(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', String(PAGE_SIZE))
        params.set('offset', String(opts.offset))
        if (opts.filters.action) params.set('action', opts.filters.action)
        if (opts.filters.actorEmail) params.set('actorEmail', opts.filters.actorEmail)
        if (opts.filters.companyId) params.set('companyId', opts.filters.companyId)
        if (opts.filters.ipAddress) params.set('ipAddress', opts.filters.ipAddress)
        if (opts.filters.since) params.set('since', new Date(opts.filters.since).toISOString())
        if (opts.filters.until) params.set('until', new Date(opts.filters.until).toISOString())

        const res = await fetch(`/api/superadmin/audit?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Kunde inte hämta revisionslogg')
        }
        const json: ListResponse = await res.json()
        setData(json)
      } catch (err: any) {
        setError(err?.message || 'Kunde inte hämta revisionslogg')
      } finally {
        setFetching(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (!token) return
    void load({ offset: page * PAGE_SIZE, filters: appliedFilters })
  }, [token, page, appliedFilters, load])

  function applyFilters(e: React.FormEvent) {
    e.preventDefault()
    setPage(0)
    setAppliedFilters({ ...filters })
  }

  function resetFilters() {
    const empty = { action: '', actorEmail: '', companyId: '', ipAddress: '', since: '', until: '' }
    setFilters(empty)
    setAppliedFilters(empty)
    setPage(0)
  }

  const totalPages = useMemo(() => {
    if (!data) return 0
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p style={{ color: PRIMARY }}>Laddar…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/superadmin" className="text-sm" style={{ color: PRIMARY }}>
              ← Tillbaka till superadmin
            </Link>
            <h1 className="mt-1 text-3xl font-extrabold" style={{ color: PRIMARY }}>
              Revisionslogg
            </h1>
            <p className="text-sm text-gray-700">
              {user?.email} · Alla säkerhetshändelser i systemet, senaste först.
            </p>
          </div>
          {data && (
            <p className="text-sm text-gray-700">
              {data.total} totalt · sida {page + 1} av {totalPages}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form
          onSubmit={applyFilters}
          className="grid gap-3 rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:grid-cols-3"
        >
          <label className="text-sm">
            <span className="block text-gray-700">Händelse</span>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Alla</option>
              {(data?.actions ?? []).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Aktör (e-post)</span>
            <input
              type="text"
              value={filters.actorEmail}
              onChange={(e) => setFilters({ ...filters, actorEmail: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="ex. demo@admin.se"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Företags-ID</span>
            <input
              type="text"
              value={filters.companyId}
              onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="cmou..."
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">IP</span>
            <input
              type="text"
              value={filters.ipAddress}
              onChange={(e) => setFilters({ ...filters, ipAddress: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Från</span>
            <input
              type="datetime-local"
              value={filters.since}
              onChange={(e) => setFilters({ ...filters, since: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Till</span>
            <input
              type="datetime-local"
              value={filters.until}
              onChange={(e) => setFilters({ ...filters, until: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Rensa
            </button>
            <button
              type="submit"
              disabled={fetching}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {fetching ? 'Söker…' : 'Tillämpa filter'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white/90 shadow-sm">
          {!data || data.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-600">
              {fetching ? 'Hämtar…' : 'Inga rader matchade filtret.'}
            </p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-700">
                  <th className="px-3 py-2">Tid</th>
                  <th className="px-3 py-2">Händelse</th>
                  <th className="px-3 py-2">Aktör</th>
                  <th className="px-3 py-2">Mål</th>
                  <th className="px-3 py-2">Företag</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Detaljer</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {new Date(row.createdAt).toLocaleString('sv-SE')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={
                          row.action.startsWith('LOGIN_FAILURE') ||
                          row.action === 'LOGIN_BLOCKED_ENDED'
                            ? 'rounded bg-red-100 px-2 py-0.5 font-medium text-red-800'
                            : row.action === 'LOGIN_SUCCESS'
                            ? 'rounded bg-green-100 px-2 py-0.5 font-medium text-green-800'
                            : row.action.startsWith('IMPERSONATE')
                            ? 'rounded bg-yellow-100 px-2 py-0.5 font-medium text-yellow-800'
                            : 'rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700'
                        }
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.actorEmail || '—'}</div>
                      {row.actorRole && (
                        <div className="text-[10px] text-gray-500">{row.actorRole}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.targetType ? (
                        <span>
                          {row.targetType}
                          {row.targetId ? `: ${row.targetId.slice(-8)}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {row.companyId ? row.companyId.slice(-8) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {row.ipAddress || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="max-w-[28rem] whitespace-pre-wrap break-words text-[10px] text-gray-600">
                        {row.details ? JSON.stringify(row.details, null, 0) : '—'}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || fetching}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 disabled:opacity-50"
            >
              ← Föregående
            </button>
            <span className="text-gray-700">
              Sida {page + 1} av {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || fetching}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-700 disabled:opacity-50"
            >
              Nästa →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
