'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isImpersonating } from '@/lib/session'

const SUPERADMIN_APP_HOME = '/superadmin'

/** Superadmin ska inte använda kund-appens sidor (utom vid impersonering). */
export default function SuperAdminAppRedirect() {
  const pathname = usePathname() || ''

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isImpersonating()) return
    if (pathname.startsWith('/superadmin')) return

    try {
      const raw = localStorage.getItem('user')
      if (!raw) return
      const parsed = JSON.parse(raw) as { role?: string }
      if (parsed.role !== 'SUPERADMIN') return

      const customerAppPrefixes = [
        '/dashboard',
        '/admin',
        '/time-report',
        '/my-reports',
        '/my-projects',
        '/my-pages',
        '/employee',
      ]
      if (customerAppPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        window.location.replace(SUPERADMIN_APP_HOME)
      }
    } catch {
      /* ignore */
    }
  }, [pathname])

  return null
}
