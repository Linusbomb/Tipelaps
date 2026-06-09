'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isImpersonating } from '@/lib/session'
import { isSuperadminBlockedPublicPath } from '@/lib/superadminPublicAccess'

/** Skickar inloggad superadmin från marknadssida/portal till /superadmin. */
export default function SuperAdminPublicRedirect() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isSuperadminBlockedPublicPath(pathname || '/')) return
    if (isImpersonating()) return

    try {
      const raw = localStorage.getItem('user')
      if (!raw) return
      const parsed = JSON.parse(raw) as { role?: string }
      if (parsed.role === 'SUPERADMIN') {
        window.location.replace('/superadmin')
      }
    } catch {
      /* ignore */
    }
  }, [pathname])

  return null
}
