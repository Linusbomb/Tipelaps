'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type CompanyRow = {
  id: string
  name: string
  createdAt: string
  owner: { id: string; name: string; email: string; role: string } | null
  counts: {
    employeesTotal: number
    employeesActive: number
    customers: number
    projects: number
  }
}

type DbDiagnostics = {
  databaseHost: string
  companyCount: number
  vercelEnv: string | null
}

const PRIMARY = '#2D5016'

export default function SuperAdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    companyName: '',
    organizationNumber: '',
    address: '',
    postalCode: '',
    city: '',
    contactEmail: '',
    phone: '',
    information: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
  })
  const [createConsent, setCreateConsent] = useState(false)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [dbDiagnostics, setDbDiagnostics] = useState<DbDiagnostics | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem('token'))
  }, [])

  useEffect(() => {
    if (!token) return
    void loadCompanies(token)
    void loadDiagnostics(token)
  }, [token])

  async function loadDiagnostics(authToken: string) {
    try {
      const res = await fetch('/api/superadmin/diagnostics', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) return
      const data: DbDiagnostics = await res.json()
      setDbDiagnostics(data)
    } catch {
      /* ignore */
    }
  }

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta företag')
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
    setCreateSuccess(null)
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
      setCreateSuccess(
        `Kund "${data.name}" skapad. Admin: ${data.owner?.email ?? form.adminEmail} — lösenord: ${form.adminPassword}. Skicka uppgifterna säkert till kunden.`
      )
      setForm({
        companyName: '',
        organizationNumber: '',
        address: '',
        postalCode: '',
        city: '',
        contactEmail: '',
        phone: '',
        information: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        adminPhone: '',
      })
      setCreateConsent(false)
      setShowCreate(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte skapa kund')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(company: CompanyRow) {
    if (!token) return
    const ownerEmail = company.owner?.email ?? 'okänd admin'
    const confirmText = `Radera kunden "${company.name}"?\n\nDetta tar bort företaget, ägaren ${ownerEmail}, alla anställda, kunder, projekt och tidrapporter. Kan inte ångras.`
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte radera kund')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {createSuccess ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {createSuccess}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: PRIMARY }}>
              Kunder ({companies.length})
            </h2>
            <p className="text-sm text-gray-600">
              Sätt upp ny kund med företag + admin-konto, eller öppna befintlig kund för att lägga
              till personal och moduler.
            </p>
            {dbDiagnostics ? (
              <p className="mt-1 text-xs text-gray-500">
                Databas: {dbDiagnostics.databaseHost}
                {dbDiagnostics.vercelEnv ? ` (${dbDiagnostics.vercelEnv})` : ''} —{' '}
                {dbDiagnostics.companyCount} företag i databasen
                {dbDiagnostics.companyCount !== companies.length && !companiesLoading ? (
                  <span className="text-amber-700">
                    {' '}
                    (listan visar {companies.length} — ladda om sidan om siffrorna skiljer sig)
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate((v) => !v)
              setCreateSuccess(null)
            }}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: PRIMARY }}
          >
            {showCreate ? 'Avbryt' : '+ Sätt upp ny kund'}
          </button>
        </div>

        {showCreate ? (
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:grid-cols-2"
          >
            <p className="sm:col-span-2 text-sm text-gray-700">
              Skapar företag, entreprenörskonto (admin) och aktiverar alla moduler som startpaket.
            </p>
            <h3 className="sm:col-span-2 text-sm font-semibold text-gray-800">Företagsuppgifter</h3>
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
              <span className="block text-gray-700">Organisationsnummer</span>
              <input
                type="text"
                value={form.organizationNumber}
                onChange={(e) => setForm({ ...form, organizationNumber: e.target.value })}
                placeholder="556677-8899"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700">Företags e-post</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700">Telefon (företag)</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-700">Gatuadress</span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700">Postnummer</span>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700">Ort</span>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-700">Övrig information</span>
              <textarea
                rows={3}
                value={form.information}
                onChange={(e) => setForm({ ...form, information: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="T.ex. avtal, kontaktperson, särskilda önskemål"
              />
            </label>
            <h3 className="sm:col-span-2 pt-2 text-sm font-semibold text-gray-800">
              Admin-konto (inloggning)
            </h3>
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
                {creating ? 'Skapar…' : 'Skapa kund och admin-konto'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          {companiesLoading ? (
            <p className="py-6 text-center text-sm text-gray-600">Laddar kunder…</p>
          ) : companies.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-600">
              Inga kunder ännu. Klicka på <strong>+ Sätt upp ny kund</strong> för att skapa företag
              och admin-konto.
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
                      {c.owner ? (
                        <>
                          <div>{c.owner.name}</div>
                          <div className="text-xs text-gray-500">{c.owner.email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-amber-700">Saknar ägare</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {c.counts.employeesActive}
                      {c.counts.employeesTotal !== c.counts.employeesActive ? (
                        <span className="text-xs text-gray-500">
                          {' '}
                          (av {c.counts.employeesTotal})
                        </span>
                      ) : null}
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

      <div className="rounded-xl border border-[#2D5016]/15 bg-white/70 p-4 text-sm text-gray-700">
        <strong style={{ color: PRIMARY }}>Så sätter du upp en kund</strong>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <strong>Sätt upp ny kund</strong> — företag + admin (entreprenör) med lösenord.
          </li>
          <li>
            <strong>Öppna kunden</strong> — lägg till personal/lönesamordnare, styr moduler, testa
            med impersonering.
          </li>
        </ol>
      </div>
    </>
  )
}
