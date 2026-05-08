'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clearLocalSession } from '@/lib/session'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

type CompanyRow = {
  id: string
  name: string
  createdAt: string
  owner: { id: string; name: string; email: string; role: string }
  counts: {
    employeesTotal: number
    employeesActive: number
    customers: number
    projects: number
  }
}

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'

export default function SuperAdminPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
  })
  const [createConsent, setCreateConsent] = useState(false)

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

  useEffect(() => {
    if (!token) return
    void loadCompanies(token)
  }, [token])

  async function loadCompanies(authToken: string) {
    setCompaniesLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/companies', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Kunde inte hämta företag')
      }
      const data: CompanyRow[] = await res.json()
      setCompanies(data)
    } catch (err: any) {
      setError(err?.message || 'Kunde inte hämta företag')
    } finally {
      setCompaniesLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!createConsent) {
      setError(
        'Bekräfta att kunden godkänt integritetspolicy och personuppgiftsbiträdesavtal innan kontot skapas.'
      )
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, consentAccepted: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Kunde inte skapa kund')
      }
      setCompanies((prev) => [data, ...prev])
      setForm({
        companyName: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
      })
      setCreateConsent(false)
      setShowCreate(false)
    } catch (err: any) {
      setError(err?.message || 'Kunde inte skapa kund')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(company: CompanyRow) {
    if (!token) return
    const confirmText = `Radera kunden "${company.name}"?\n\nDetta tar bort företaget, ägaren ${company.owner.email}, alla anställda, kunder, projekt och tidrapporter. Kan inte ångras.`
    if (!window.confirm(confirmText)) return
    setDeletingId(company.id)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Kunde inte radera kund')
      }
      setCompanies((prev) => prev.filter((c) => c.id !== company.id))
    } catch (err: any) {
      setError(err?.message || 'Kunde inte radera kund')
    } finally {
      setDeletingId(null)
    }
  }

  function handleLogout() {
    clearLocalSession()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <p style={{ color: PRIMARY }}>Laddar…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
              Superadmin
            </h1>
            <p className="text-sm text-gray-700">
              Inloggad som <strong>{user?.name}</strong> ({user?.email})
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Startsida
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Logga ut
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>
                Kunder ({companies.length})
              </h2>
              <p className="text-sm text-gray-600">
                Varje kund har egen data. Anställda i en kund ser aldrig data från andra kunder.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: PRIMARY }}
            >
              {showCreate ? 'Avbryt' : '+ Ny kund'}
            </button>
          </div>

          {showCreate && (
            <form
              onSubmit={handleCreate}
              className="mt-4 grid gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:grid-cols-2"
            >
              <label className="text-sm sm:col-span-2">
                <span className="block text-gray-700">Företagsnamn *</span>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Adminnamn *</span>
                <input
                  type="text"
                  required
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Admin-telefon</span>
                <input
                  type="tel"
                  value={form.adminPhone}
                  onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Admin-e-post *</span>
                <input
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Lösenord *</span>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Min 6 tecken. Skicka detta säkert till kunden.
                </span>
              </label>
              <label className="sm:col-span-2 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  required
                  checked={createConsent}
                  onChange={(e) => setCreateConsent(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Jag bekräftar att kunden har tagit del av{' '}
                  <Link
                    href="/integritetspolicy"
                    className="underline"
                    style={{ color: PRIMARY }}
                    target="_blank"
                    rel="noopener"
                  >
                    integritetspolicyn
                  </Link>{' '}
                  och accepterat personuppgiftsbiträdesavtalet.
                </span>
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={creating || !createConsent}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {creating ? 'Skapar…' : 'Skapa kund'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 overflow-x-auto">
            {companiesLoading ? (
              <p className="py-6 text-center text-sm text-gray-600">Laddar kunder…</p>
            ) : companies.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-600">
                Inga kunder ännu. Klicka på <strong>+ Ny kund</strong> för att skapa den första.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">Företag</th>
                    <th className="py-2 pr-4">Admin (ägare)</th>
                    <th className="py-2 pr-4">Anställda</th>
                    <th className="py-2 pr-4">Kunder</th>
                    <th className="py-2 pr-4">Projekt</th>
                    <th className="py-2 pr-4">Skapad</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-t border-gray-200 align-top">
                      <td className="py-3 pr-4 font-medium" style={{ color: PRIMARY }}>
                        <Link href={`/superadmin/companies/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <div>{c.owner.name}</div>
                        <div className="text-xs text-gray-500">{c.owner.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        {c.counts.employeesActive}
                        {c.counts.employeesTotal !== c.counts.employeesActive && (
                          <span className="text-xs text-gray-500">
                            {' '}
                            (av {c.counts.employeesTotal})
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{c.counts.customers}</td>
                      <td className="py-3 pr-4">{c.counts.projects}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(c.createdAt).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/superadmin/companies/${c.id}`}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Öppna
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            disabled={deletingId === c.id}
                            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingId === c.id ? 'Raderar…' : 'Radera'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white/70 p-4 text-xs text-gray-600">
          <strong>Tips:</strong> Logga in som kundens admin (med deras e-post och lösenord) för att se
          deras vy. Varje kund-admin kan sedan själv lägga till personal via{' '}
          <code className="rounded bg-gray-100 px-1">/admin</code>.
        </div>
      </div>
    </div>
  )
}
