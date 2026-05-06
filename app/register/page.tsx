'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const [fresh, setFresh] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    companyName: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/setup/fresh-database')
        const data = await r.json()
        if (!cancelled) setFresh(!!data.isFreshDatabase)
      } catch {
        if (!cancelled) setFresh(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleEntrepreneurRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          companyName: form.companyName,
          role: 'ENTREPRENEUR',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registrering misslyckades')
      router.push('/login?type=admin&registered=true')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  if (fresh === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center py-12 px-4"
        style={{ backgroundColor: '#E8E8D8' }}
      >
        <p style={{ color: '#2D5016' }}>Laddar…</p>
      </div>
    )
  }

  if (!fresh) {
    return (
      <div
        className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: '#E8E8D8' }}
      >
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Konton skapas av admin
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Personal kan inte registrera konto själva.
              <br />
              Be din admin skapa ditt konto så får du en e-post för att välja lösenord.
              <br />
              <br />
              <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Till inloggning
              </Link>
            </p>
          </div>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-2 px-4 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              Gå till inloggning
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: '#E8E8D8' }}
    >
      <div className="max-w-md w-full space-y-6 rounded-xl border border-gray-200 bg-white/80 p-8 shadow-sm">
        <div>
          <h2 className="text-center text-2xl font-extrabold" style={{ color: '#2D5016' }}>
            Första kontot (entreprenör)
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Databasen är tom. Skapa administratörskonto och företag. Sedan loggar du in via{' '}
            <strong>Admin</strong> på startsidan.
          </p>
        </div>
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <form className="space-y-4" onSubmit={handleEntrepreneurRegister}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Företagsnamn</label>
            <input
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Ditt namn</label>
            <input
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-post</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefon (valfritt)</label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Lösenord</label>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-2 px-4 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#2D5016' }}
          >
            {loading ? 'Skapar konto…' : 'Skapa konto'}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link href="/" style={{ color: '#2D5016' }}>
            Till startsidan
          </Link>
        </p>
      </div>
    </div>
  )
}
