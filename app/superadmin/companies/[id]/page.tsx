'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

type CompanyDetail = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  owner: { id: string; name: string; email: string; role: string }
  employees: {
    id: string
    name: string
    email: string
    role: string
    employmentEndedAt: string | null
    createdAt: string
  }[]
  customers: { id: string; name: string }[]
  projects: { id: string; name: string }[]
}

export default function SuperAdminCompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const companyId = params?.id

  const [user, setUser] = useState<SessionUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const [impersonating, setImpersonating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

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
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    if (!token || !companyId) return
    void loadCompany(token, companyId)
  }, [token, companyId])

  async function loadCompany(authToken: string, id: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Kunde inte hämta företag')
      }
      const data: CompanyDetail = await res.json()
      setCompany(data)
      setRenameValue(data.name)
    } catch (err: any) {
      setError(err?.message || 'Kunde inte hämta företag')
    } finally {
      setLoading(false)
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !company) return
    if (!renameValue.trim() || renameValue.trim() === company.name) return
    setRenaming(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte byta namn')
      setCompany({ ...company, name: data.name, updatedAt: data.updatedAt })
      setInfo('Namnet uppdaterades')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte byta namn')
    } finally {
      setRenaming(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !company) return
    if (newPassword.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken')
      return
    }
    setResetting(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(
        `/api/superadmin/companies/${company.id}/reset-admin-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password: newPassword }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte återställa lösenord')
      setInfo(`Nytt lösenord satt för ${company.owner.email}. Skicka det säkert till kunden.`)
      setNewPassword('')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte återställa lösenord')
    } finally {
      setResetting(false)
    }
  }

  async function handleImpersonate() {
    if (!token || !company || !user) return
    if (
      !window.confirm(
        `Logga in som ${company.owner.email} och se kundens vy? Du kan när som helst återgå till superadmin via banner.`
      )
    ) {
      return
    }
    setImpersonating(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte logga in som kund')

      const superToken = localStorage.getItem('token')
      const superUser = localStorage.getItem('user')
      if (superToken) localStorage.setItem('superadminToken', superToken)
      if (superUser) localStorage.setItem('superadminUser', superUser)

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem(
        'impersonatedAs',
        JSON.stringify({
          superEmail: user.email,
          asEmail: data.user.email,
          asName: data.user.name,
          companyName: data.company?.name,
        })
      )
      window.location.href = '/admin'
    } catch (err: any) {
      setError(err?.message || 'Kunde inte logga in som kund')
      setImpersonating(false)
    }
  }

  async function handleExport() {
    if (!token || !company) return
    setExporting(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Kunde inte exportera data')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `timelaps-foretag-${company.id}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setInfo('Export laddades ner. Behandla filen säkert.')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte exportera data')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (!token || !company) return
    if (
      !window.confirm(
        `Radera kunden "${company.name}"?\n\nDetta tar bort företaget, ägaren ${company.owner.email}, alla anställda, kunder, projekt och tidrapporter. Kan inte ångras.`
      )
    ) {
      return
    }
    setDeleting(true)
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
      router.push('/superadmin')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte radera kund')
      setDeleting(false)
    }
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p style={{ color: PRIMARY }}>Laddar…</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-3xl space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <Link href="/superadmin" style={{ color: PRIMARY }}>
            ← Tillbaka till listan
          </Link>
        </div>
      </div>
    )
  }

  const activeEmployees = company.employees.filter(
    (e) => e.id !== company.owner.id && e.employmentEndedAt == null
  )
  const endedEmployees = company.employees.filter((e) => e.employmentEndedAt != null)

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/superadmin" className="text-sm" style={{ color: PRIMARY }}>
            ← Tillbaka till alla kunder
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold" style={{ color: PRIMARY }}>
            {company.name}
          </h1>
          <p className="text-sm text-gray-600">
            Skapad {new Date(company.createdAt).toLocaleDateString('sv-SE')} • Ägare:{' '}
            <strong>{company.owner.name}</strong> ({company.owner.email})
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {info}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Anställda (aktiva)" value={activeEmployees.length} />
          <Stat label="Anställda (avslutade)" value={endedEmployees.length} />
          <Stat label="Kunder" value={company.customers.length} />
          <Stat label="Projekt" value={company.projects.length} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Byt företagsnamn">
            <form onSubmit={handleRename} className="space-y-3">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={renaming || !renameValue.trim() || renameValue.trim() === company.name}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
              >
                {renaming ? 'Sparar…' : 'Spara namn'}
              </button>
            </form>
          </Card>

          <Card title="Återställ admin-lösenord">
            <p className="mb-2 text-xs text-gray-600">
              Sätter ett nytt lösenord för {company.owner.email}. Skicka det säkert till kunden.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nytt lösenord (minst 6 tecken)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={resetting || newPassword.length < 6}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
              >
                {resetting ? 'Sparar…' : 'Sätt nytt lösenord'}
              </button>
            </form>
          </Card>

          <Card title="Logga in som kundens admin">
            <p className="mb-3 text-xs text-gray-600">
              Du hamnar i kundens vy med en gul banner högst upp för att återgå. Tokenen är giltig i
              1 timme och händelsen skrivs i revisionsloggen.
            </p>
            <button
              type="button"
              onClick={handleImpersonate}
              disabled={impersonating}
              className="rounded-md border border-yellow-500 bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-900 hover:bg-yellow-200 disabled:opacity-60"
            >
              {impersonating ? 'Loggar in…' : 'Logga in som ' + company.owner.email}
            </button>
          </Card>

          <Card title="Exportera kundens data (GDPR)">
            <p className="mb-3 text-xs text-gray-600">
              Ladda ner all data för {company.name} som JSON. Behandla filen säkert.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {exporting ? 'Förbereder…' : 'Ladda ner export'}
            </button>
          </Card>

          <Card title="Radera kund (farligt)">
            <p className="mb-3 text-xs text-gray-600">
              Tar bort företaget, ägaren, alla anställda, kunder, projekt och tidrapporter. Kan inte
              ångras.
            </p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? 'Raderar…' : 'Radera ' + company.name}
            </button>
          </Card>
        </div>

        <Card title={`Anställda (${activeEmployees.length} aktiva)`}>
          {activeEmployees.length === 0 ? (
            <p className="text-sm text-gray-600">Inga anställda ännu.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Namn</th>
                  <th className="py-2 pr-4">E-post</th>
                  <th className="py-2 pr-4">Roll</th>
                  <th className="py-2 pr-4">Skapad</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((e) => (
                  <tr key={e.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4">{e.name}</td>
                    <td className="py-2 pr-4">{e.email}</td>
                    <td className="py-2 pr-4">{roleLabel(e.role)}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(e.createdAt).toLocaleDateString('sv-SE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {endedEmployees.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-700">
                Visa avslutade anställningar ({endedEmployees.length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {endedEmployees.map((e) => (
                  <li key={e.id}>
                    {e.name} – {e.email}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: PRIMARY }}>
        {value}
      </p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/90 p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold" style={{ color: PRIMARY }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function roleLabel(role: string) {
  switch (role) {
    case 'ENTREPRENEUR':
      return 'Företagsadmin'
    case 'PAYROLL_COORDINATOR':
      return 'Lönesamordnare'
    case 'EMPLOYEE':
      return 'Personal'
    case 'SUPERADMIN':
      return 'Superadmin'
    default:
      return role
  }
}
