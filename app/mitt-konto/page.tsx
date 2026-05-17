'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  companyId: string | null
}

export default function MyAccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportingSelf, setExportingSelf] = useState(false)
  const [exportingCompany, setExportingCompany] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('token')
    const u = localStorage.getItem('user')
    if (!t || !u) {
      window.location.href = '/login'
      return
    }
    try {
      const parsed: SessionUser = JSON.parse(u)
      setUser(parsed)
      setToken(t)
    } catch {
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }, [])

  async function downloadExport(url: string, filename: string, kind: 'self' | 'company') {
    if (!token) return
    if (kind === 'self') setExportingSelf(true)
    else setExportingCompany(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Kunde inte exportera data')
      }
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)
      setInfo('Filen laddades ner. Spara den säkert – den innehåller personuppgifter.')
    } catch (err: any) {
      setError(err?.message || 'Kunde inte exportera data')
    } finally {
      if (kind === 'self') setExportingSelf(false)
      else setExportingCompany(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p style={{ color: PRIMARY }}>Laddar…</p>
      </div>
    )
  }
  if (!user) return null

  const isAdmin =
    user.role === 'ENTREPRENEUR' || user.role === 'PAYROLL_COORDINATOR'

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
            Mitt konto
          </h1>
          <p className="text-sm text-gray-700">
            {user.name} ({user.email})
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

        <section className="rounded-xl border border-gray-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-base font-semibold" style={{ color: PRIMARY }}>
            Ladda ner mina personuppgifter (GDPR)
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Du har enligt GDPR rätt att få tillgång till alla uppgifter vi behandlar om dig. Klicka
            nedan för att ladda ner dem som JSON-fil. Lösenord och säkerhetstokens ingår aldrig.
          </p>
          <button
            type="button"
            onClick={() =>
              downloadExport(
                '/api/users/me/export',
                `timelaps-mina-uppgifter-${user.id}.json`,
                'self'
              )
            }
            disabled={exportingSelf}
            className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {exportingSelf ? 'Förbereder…' : 'Ladda ner mina uppgifter'}
          </button>
        </section>

        {isAdmin && user.companyId && (
          <section className="rounded-xl border border-gray-200 bg-white/90 p-5 shadow-sm">
            <h2 className="text-base font-semibold" style={{ color: PRIMARY }}>
              Exportera hela företagets data
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Som administratör (personuppgiftsansvarig för dina anställda) kan du ladda ner en
              komplett export av företagets data. Behandla filen säkert.
            </p>
            <button
              type="button"
              onClick={() =>
                downloadExport(
                  '/api/admin/company-export',
                  `timelaps-foretag-${user.companyId}.json`,
                  'company'
                )
              }
              disabled={exportingCompany}
              className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {exportingCompany ? 'Förbereder…' : 'Ladda ner företagsdata'}
            </button>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white/90 p-5 shadow-sm">
          <h2 className="text-base font-semibold" style={{ color: PRIMARY }}>
            Dina rättigheter
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Du har rätt till tillgång, rättelse, radering, begränsning och invändning. Läs mer i{' '}
            <Link href="/integritetspolicy" className="underline" style={{ color: PRIMARY }}>
              integritetspolicyn
            </Link>
            . Vill du raderas? Kontakta din administratör eller leverantörens support.
          </p>
        </section>

        <p>
          <Link href="/" className="text-sm" style={{ color: PRIMARY }}>
            ← Till startsidan
          </Link>
        </p>
      </div>
    </div>
  )
}
