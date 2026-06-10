'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  isModuleEnabled,
  type CompanyModuleId,
} from '@/lib/companyModules'

type CompanyModulesContextValue = {
  enabledModules: CompanyModuleId[]
  loaded: boolean
  hasModule: (moduleId: CompanyModuleId) => boolean
  refreshModules: () => void
}

const CompanyModulesContext = createContext<CompanyModulesContextValue | null>(null)

const FALLBACK_MODULES: CompanyModuleId[] = ['time_reports']

export function CompanyModulesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [enabledModules, setEnabledModules] = useState<CompanyModuleId[]>(FALLBACK_MODULES)
  const [loaded, setLoaded] = useState(false)

  const fetchModules = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setEnabledModules(FALLBACK_MODULES)
      setLoaded(true)
      return
    }

    try {
      const res = await fetch('/api/company/modules', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) {
        setEnabledModules(FALLBACK_MODULES)
        return
      }
      const data = await res.json()
      const modules = Array.isArray(data?.modules) ? data.modules : FALLBACK_MODULES
      setEnabledModules(modules)
    } catch {
      setEnabledModules(FALLBACK_MODULES)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void fetchModules()
  }, [fetchModules, pathname])

  useEffect(() => {
    const onFocus = () => void fetchModules()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchModules])

  const hasModule = useCallback(
    (moduleId: CompanyModuleId) => {
      if (!loaded) return moduleId === 'time_reports'
      return isModuleEnabled(enabledModules, moduleId)
    },
    [enabledModules, loaded]
  )

  const value = useMemo(
    () => ({
      enabledModules,
      loaded,
      hasModule,
      refreshModules: fetchModules,
    }),
    [enabledModules, loaded, hasModule, fetchModules]
  )

  return (
    <CompanyModulesContext.Provider value={value}>{children}</CompanyModulesContext.Provider>
  )
}

export function useCompanyModules() {
  const ctx = useContext(CompanyModulesContext)
  if (!ctx) {
    throw new Error('useCompanyModules måste användas inom CompanyModulesProvider')
  }
  return ctx
}
