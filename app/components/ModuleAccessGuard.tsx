'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCompanyModules } from '@/contexts/CompanyModulesContext'
import { moduleRequiredForPath } from '@/lib/routeModuleAccess'

/** Omdirigerar till dashboard om användaren öppnar en sida vars modul är avstängd. */
export default function ModuleAccessGuard() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { loaded, hasModule } = useCompanyModules()

  useEffect(() => {
    if (!loaded) return
    const required = moduleRequiredForPath(pathname)
    if (required && !hasModule(required)) {
      router.replace('/dashboard')
    }
  }, [pathname, loaded, hasModule, router])

  return null
}
