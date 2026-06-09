'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import SuperAdminCompanyModulesPanel from '@/app/components/SuperAdminCompanyModulesPanel'
import SuperAdminAddUserPanel from '@/app/components/SuperAdminAddUserPanel'

const PRIMARY = '#2D5016'

type CompanyDetail = {
  id: string
  name: string
  organizationNumber: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  contactEmail: string | null
  phone: string | null
  information: string | null
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

  const [token, setToken] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [renameValue, setRenameValue] = useState('')
  const [profileForm, setProfileForm] = useState({
    organizationNumber: '',
    address: '',
    postalCode: '',
    city: '',
    contactEmail: '',
    phone: '',
    information: '',
  })
  const [renaming, setRenaming] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const [impersonating, setImpersonating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setToken(localStorage.getItem('token'))
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
      setProfileForm({
        organizationNumber: data.organizationNumber ?? '',
        address: data.address ?? '',
        postalCode: data.postalCode ?? '',
        city: data.city ?? '',
        contactEmail: data.contactEmail ?? '',
        phone: data.phone ?? '',
        information: data.information ?? '',
      })
    } catch (err: any) {
      setError(err?.message || 'Kunde inte hämta företag')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !company) return
    if (
      !renameValue.trim() &&
      !profileForm.organizationNumber &&
      !profileForm.address &&
      !profileForm.postalCode &&
      !profileForm.city &&
      !profileForm.contactEmail &&
      !profileForm.phone &&
      !profileForm.information
    ) {
      return
    }
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
        body: JSON.stringify({
          name: renameValue.trim(),
          ...profileForm,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte spara företagsuppgifter')
      setCompany({
        ...company,
        name: data.name,
        organizationNumber: data.organizationNumber,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        contactEmail: data.contactEmail,
        phone: data.phone,
        information: data.information,
        updatedAt: data.updatedAt,
      })
      setInfo('Företagsuppgifter sparades')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte spara företagsuppgifter')
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
    if (!token || !company) return
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
      const superUserRaw = localStorage.getItem('user')
      let superEmail = 'superadmin'
      if (superUserRaw) {
        try {
          superEmail = JSON.parse(superUserRaw).email ?? superEmail
        } catch {
          /* ignore */
        }
      }

      if (superToken) localStorage.setItem('superadminToken', superToken)
      if (superUserRaw) localStorage.setItem('superadminUser', superUserRaw)

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem(
        'impersonatedAs',
        JSON.stringify({
          superEmail,
          asEmail: data.user.email,
          asName: data.user.name,
          companyName: data.company?.name ?? company.name,
        })
      )
      window.location.href = '/dashboard'
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

  if (loading) {
    return <p className="text-sm text-gray-600">Laddar kund…</p>
  }

  if (!company) {
    return (
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <Link href="/superadmin" style={{ color: PRIMARY }}>
          ← Tillbaka till kundlistan
        </Link>
      </div>
    )
  }

  const activeEmployees = company.employees.filter(
    (e) => e.id !== company.owner.id && e.employmentEndedAt == null
  )
  const endedEmployees = company.employees.filter((e) => e.employmentEndedAt != null)

  return (
    <div className="space-y-6">
        <div>
          <Link href="/superadmin" className="text-sm" style={{ color: PRIMARY }}>
            ← Tillbaka till alla kunder
          </Link>
          <h2 className="mt-2 text-2xl font-extrabold" style={{ color: PRIMARY }}>
            {company.name}
          </h2>
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
          <Card title="Företagsuppgifter">
            <form onSubmit={handleSaveCompany} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="block text-gray-700">Företagsnamn *</span>
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Organisationsnummer</span>
                <input
                  type="text"
                  value={profileForm.organizationNumber}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, organizationNumber: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Företags e-post</span>
                <input
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, contactEmail: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Telefon</span>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block text-gray-700">Gatuadress</span>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Postnummer</span>
                <input
                  type="text"
                  value={profileForm.postalCode}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, postalCode: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-700">Ort</span>
                <input
                  type="text"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block text-gray-700">Övrig information</span>
                <textarea
                  rows={3}
                  value={profileForm.information}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, information: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={renaming}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {renaming ? 'Sparar…' : 'Spara företagsuppgifter'}
                </button>
              </div>
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

          <Card title="Moduler">
            {token && companyId ? (
              <SuperAdminCompanyModulesPanel companyId={companyId} token={token} />
            ) : null}
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

        <Card title={`Anställda och användare (${activeEmployees.length} aktiva)`}>
          {token && companyId ? (
            <div className="mb-4">
              <SuperAdminAddUserPanel
                companyId={companyId}
                token={token}
                onCreated={() => void loadCompany(token, companyId)}
              />
            </div>
          ) : null}
          {activeEmployees.length === 0 ? (
            <p className="text-sm text-gray-600">Inga anställda ännu utöver admin.</p>
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
