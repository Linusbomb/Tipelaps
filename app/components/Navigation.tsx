'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { decodeJwtPayload } from '@/lib/decodeJwtPayload'
import AdminNavMenu from '@/app/components/AdminNavMenu'
import { useCompanyModules } from '@/contexts/CompanyModulesContext'

const PROJECTS_BADGE_EVENT = 'projects-badge-refresh'

const NAV_HIDDEN_PATHS = [
  '/',
  '/portal',
  '/funktioner',
  '/om-oss',
  '/sa-funkar-det',
  '/varfor-oss',
  '/kontakt',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/superadmin',
]

const ACTIVE_NAV_STYLE = { backgroundColor: '#2D5016', color: '#FFFFFF' } as const
const INACTIVE_NAV_STYLE = { color: '#2D5016' } as const

function isNavLinkActive(pathname: string, href: string): boolean {
  const path = (pathname || '/').split('?')[0]

  if (path === href) return true

  switch (href) {
    case '/dashboard':
      return path === '/dashboard'
    case '/time-report':
      return path.startsWith('/time-report/')
    case '/my-reports':
      return path.startsWith('/my-reports/')
    case '/my-projects':
      return path.startsWith('/my-projects')
    case '/my-pages':
      return path.startsWith('/my-pages')
    default:
      return false
  }
}

function navLinkClassName(isActive: boolean, mobile: boolean): string {
  const base = mobile
    ? 'block w-full px-3 py-2 text-sm font-medium rounded-md'
    : 'inline-flex items-center px-6 py-2.5 text-sm font-medium rounded-md min-h-[2.75rem]'
  if (isActive) {
    return `${base} font-semibold text-white shadow-sm`
  }
  return `${base} hover:bg-gray-100`
}

function AppNavLink({
  href,
  pathname,
  mobile = false,
  className = '',
  children,
}: {
  href: string
  pathname: string
  mobile?: boolean
  className?: string
  children: ReactNode
}) {
  const active = isNavLinkActive(pathname, href)
  return (
    <Link
      href={href}
      className={[navLinkClassName(active, mobile), className].filter(Boolean).join(' ')}
      style={active ? ACTIVE_NAV_STYLE : INACTIVE_NAV_STYLE}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}

function hasDashboardNav(role: string | null): boolean {
  return role === 'ENTREPRENEUR' || role === 'PAYROLL_COORDINATOR' || role === 'EMPLOYEE'
}

export default function Navigation() {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [projectsPendingCount, setProjectsPendingCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { enabledModules, hasModule } = useCompanyModules()

  const fetchProjectsBadge = useCallback(async () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('token')
    if (!token) {
      setProjectsPendingCount(0)
      return
    }
    try {
      const res = await fetch('/api/projects/my-projects/pending-count', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      setProjectsPendingCount(typeof data?.count === 'number' ? data.count : 0)
    } catch {
      setProjectsPendingCount(0)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const payload = decodeJwtPayload(token)
      const role = typeof payload?.role === 'string' ? payload.role : null
      if (payload && role) {
        setIsLoggedIn(true)
        setUserRole(role)
      } else {
        setIsLoggedIn(false)
        setUserRole(null)
      }
    } else {
      setIsLoggedIn(false)
      setUserRole(null)
    }
  }, [pathname])

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'EMPLOYEE') {
      setProjectsPendingCount(0)
      return
    }
    if (!hasModule('projects')) {
      setProjectsPendingCount(0)
      return
    }
    fetchProjectsBadge()
  }, [isLoggedIn, userRole, pathname, fetchProjectsBadge, hasModule, enabledModules])

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'EMPLOYEE') return undefined
    if (!hasModule('projects')) return undefined
    const handler = () => fetchProjectsBadge()
    window.addEventListener(PROJECTS_BADGE_EVENT, handler)
    return () => window.removeEventListener(PROJECTS_BADGE_EVENT, handler)
  }, [isLoggedIn, userRole, fetchProjectsBadge, hasModule])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUserRole(null)
    router.push('/login')
  }

  if (NAV_HIDDEN_PATHS.includes(pathname || '') || (pathname || '').startsWith('/superadmin/')) {
    return null
  }

  if (!isLoggedIn) {
    return null
  }

  const currentPath = pathname || ''
  const isAdmin = userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR'
  const hasProjectsModule = hasModule('projects')
  const hasEmployeeDocsModule = hasModule('employee_docs')

  const navLinks = isAdmin ? (
    <AdminNavMenu pathname={currentPath} enabledModules={enabledModules} />
  ) : (
    <div className="flex flex-wrap items-stretch justify-center gap-1 sm:gap-2">
      {hasDashboardNav(userRole) && (
        <AppNavLink href="/dashboard" pathname={currentPath}>
          {t('nav.dashboard')}
        </AppNavLink>
      )}
      <AppNavLink href="/time-report" pathname={currentPath}>
        {t('nav.timeReport')}
      </AppNavLink>
      {userRole === 'EMPLOYEE' && (
        <AppNavLink href="/my-reports" pathname={currentPath}>
          {t('nav.myReports')}
        </AppNavLink>
      )}
      {userRole === 'EMPLOYEE' && hasProjectsModule && (
        <AppNavLink href="/my-projects" pathname={currentPath} className="gap-2">
          <span>Mina projekt</span>
          {projectsPendingCount > 0 ? (
            <span
              className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-600 text-[11px] font-bold leading-5 text-white text-center shrink-0"
              title={`${projectsPendingCount} projekt väntar på att du öppnar och godkänner`}
              aria-label={`${projectsPendingCount} väntande projekt`}
            >
              {projectsPendingCount > 99 ? '99+' : projectsPendingCount}
            </span>
          ) : null}
        </AppNavLink>
      )}
      {hasEmployeeDocsModule ? (
        <AppNavLink href="/my-pages" pathname={currentPath}>
          {t('nav.myPages')}
        </AppNavLink>
      ) : null}
    </div>
  )

  const mobileNavLinks = isAdmin ? (
    <AdminNavMenu
      pathname={currentPath}
      mobile
      enabledModules={enabledModules}
      onNavigate={() => setIsMobileMenuOpen(false)}
    />
  ) : (
    <>
      {hasDashboardNav(userRole) && (
        <AppNavLink href="/dashboard" pathname={currentPath} mobile>
          {t('nav.dashboard')}
        </AppNavLink>
      )}
      <AppNavLink href="/time-report" pathname={currentPath} mobile>
        {t('nav.timeReport')}
      </AppNavLink>
      {userRole === 'EMPLOYEE' && (
        <AppNavLink href="/my-reports" pathname={currentPath} mobile>
          {t('nav.myReports')}
        </AppNavLink>
      )}
      {userRole === 'EMPLOYEE' && hasProjectsModule && (
        <AppNavLink
          href="/my-projects"
          pathname={currentPath}
          mobile
          className="flex items-center justify-between"
        >
          <span>Mina projekt</span>
          {projectsPendingCount > 0 ? (
            <span
              className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-600 text-[11px] font-bold leading-5 text-white text-center shrink-0"
              title={`${projectsPendingCount} projekt väntar på att du öppnar och godkänner`}
              aria-label={`${projectsPendingCount} väntande projekt`}
            >
              {projectsPendingCount > 99 ? '99+' : projectsPendingCount}
            </span>
          ) : null}
        </AppNavLink>
      )}
      {hasEmployeeDocsModule ? (
        <AppNavLink href="/my-pages" pathname={currentPath} mobile>
          {t('nav.myPages')}
        </AppNavLink>
      ) : null}
    </>
  )

  return (
    <nav
      className="sticky top-0 z-50 bg-white shadow-md"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <div className="max-w-[100%] mx-auto px-3 sm:px-4 lg:px-8">
        <div className="py-2">
          <div className="relative hidden md:flex md:items-center md:justify-center md:min-h-[3.25rem] md:py-1">
            <div className="flex w-full justify-center overflow-visible px-16" aria-label="Huvudmeny">
              {navLinks}
            </div>

            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center rounded-xl border border-[#2D5016]/15 bg-[#EEF6E8] px-4 py-2 text-sm font-semibold hover:bg-[#E2F0D9] min-h-[2.5rem] whitespace-nowrap"
                style={{ color: '#2D5016' }}
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>

          <div className="flex md:hidden items-center min-h-14 gap-2 sm:gap-3 py-1">
            <button
              type="button"
              className="ml-auto inline-flex items-center justify-center rounded-xl border border-[#2D5016]/15 bg-[#EEF6E8] px-4 py-2.5 text-sm font-semibold"
              style={{ color: '#2D5016', borderColor: '#D1D5DB' }}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Öppna meny"
            >
              {isMobileMenuOpen ? 'Stäng' : 'Meny'}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden mt-2 border-t border-[#2D5016]/10 pt-3 pb-2 space-y-2">
              {mobileNavLinks}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-xl border border-[#2D5016]/15 bg-[#EEF6E8] px-4 py-3 text-left text-sm font-semibold hover:bg-[#E2F0D9]"
                style={{ color: '#2D5016' }}
              >
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}