'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    companyName: '',
  })

  const handleEntrepreneurRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          companyName: form.companyName.trim(),
          role: 'ENTREPRENEUR',
        }),
      })
      const raw = await res.text()
      let data: { error?: string } = {}
      if (raw) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error('Ogiltigt svar från servern.')
        }
      }
      if (!res.ok) throw new Error(data.error || 'Registrering misslyckades')
      router.push('/login?type=admin&registered=true')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: '#E8E8D8' }}
    >
      <div className="max-w-lg w-full space-y-8">
        <div className="rounded-xl border border-gray-200 bg-white/90 p-8 shadow-sm">
          <div>
            <h2 className="text-center text-2xl font-extrabold" style={{ color: '#2D5016' }}>
              Skapa administratörskonto
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Registrera dig som <strong>entreprenör/admin</strong> och ditt företag. Du loggar sedan in via{' '}
              <strong>Admin</strong> på startsidan.
            </p>
          </div>
          {error && (
            <div className="mt-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <form className="mt-6 space-y-4" onSubmit={handleEntrepreneurRegister}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Företagsnamn</label>
              <input
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Ex. Månssons Mark AB"
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
                autoComplete="email"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefon (valfritt)</label>
              <input
                type="tel"
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
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">Minst 8 tecken.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md py-2 px-4 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {loading ? 'Skapar konto…' : 'Skapa admin-konto'}
            </button>
          </form>
        </div>

        <div
          className="rounded-xl border px-6 py-5 text-sm text-gray-700"
          style={{ borderColor: 'rgba(45, 80, 22, 0.35)', backgroundColor: 'rgba(255,255,255,0.6)' }}
        >
          <p className="font-semibold" style={{ color: '#2D5016' }}>
            Personal?
          </p>
          <p className="mt-1">
            Anställda kan inte registrera sig själva här. Din arbetsgivare skapar ditt konto i adminläget –
            du får då inloggningsuppgifter eller inbjudan.
          </p>
          <Link href="/login?type=employee" className="mt-3 inline-block font-medium" style={{ color: '#2D5016' }}>
            Gå till inloggning för personal →
          </Link>
        </div>

        <p className="text-center text-sm">
          <Link href="/" style={{ color: '#2D5016' }}>
            ← Till startsidan
          </Link>
        </p>
      </div>
    </div>
  )
}
