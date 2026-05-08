'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

export default function SuperAdminPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token || !userData) {
      window.location.href = '/login?type=admin'
      return
    }
    try {
      const parsed: SessionUser = JSON.parse(userData)
      if (parsed.role !== 'SUPERADMIN') {
        window.location.href = '/admin'
        return
      }
      setUser(parsed)
    } catch {
      window.location.href = '/login?type=admin'
      return
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#E8E8D8' }}
      >
        <p style={{ color: '#2D5016' }}>Laddar…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8" style={{ backgroundColor: '#E8E8D8' }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold" style={{ color: '#2D5016' }}>
            Superadmin
          </h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logga ut
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm">
          <p className="text-sm text-gray-600">Inloggad som</p>
          <p className="text-lg font-semibold" style={{ color: '#2D5016' }}>
            {user?.name} ({user?.email})
          </p>
        </div>

        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">Fas 2 – under uppbyggnad</h2>
          <p className="mt-2 text-sm text-yellow-900">
            Backend-stödet för superadmin är klart (rollkontroll och inloggning). Nästa steg är att bygga
            UI:t här: lista alla företag, skapa nya kunder, se data per företag.
          </p>
          <p className="mt-2 text-sm text-yellow-900">
            Tills vidare kan du administrera systemet direkt mot databasen eller via en kund-admin.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
            Snabblänkar
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" style={{ color: '#2D5016' }}>
                ← Till startsidan
              </Link>
            </li>
            <li>
              <Link href="/admin" style={{ color: '#2D5016' }}>
                Försök öppna kund-admin (kommer be dig välja kund senare)
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
