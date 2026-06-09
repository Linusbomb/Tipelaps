'use client'

import { useEffect, useState } from 'react'
import SuperAdminShell from '@/app/components/SuperAdminShell'

const BG = '#E8E8D8'
const PRIMARY = '#2D5016'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    if (!token || !raw) {
      window.location.href = '/login?type=admin'
      return
    }
    try {
      const parsed: SessionUser = JSON.parse(raw)
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

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <p style={{ color: PRIMARY }}>Laddar superadmin…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-6xl">
        <SuperAdminShell user={user}>{children}</SuperAdminShell>
      </div>
    </div>
  )
}
