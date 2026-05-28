'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { decodeJwtPayload } from '@/lib/decodeJwtPayload'

const PROJECTS_BADGE_EVENT = 'projects-badge-refresh'

const NAV_HIDDEN_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password']

const ACTIVE_NAV_STYLE = { backgroundColor: '#2D5016', color: '#FFFFFF' } as const
const INACTIVE_NAV_STYLE = { color: '#2D5016' } as const

function isNavLinkActive(pathname: string, href: string): boolean {
  const path = (pathname || '/').split('?')[0]

  if (path === href) return true

  switch (href) {
    case '/dashboard':
      return path === '/dashboard'
    case '/admin':
      return (
        path.startsWith('/admin/customers') ||
        path.startsWith('/admin/time-reports') ||
        path.startsWith('/admin/logo')
      )
    case '/time-report':
      return path.startsWith('/time-report/')
    case '/my-reports':
      return path.startsWith('/my-reports/')
    case '/my-projects':
      return path.startsWith('/my-projects')
    case '/my-pages':
      return path.startsWith('/my-pages')
    case '/create-project':
      return path.startsWith('/create-project')
    case '/admin/my-staff':
      return path.startsWith('/admin/my-staff')
    case '/admin/payroll-hours':
      return path.startsWith('/admin/payroll-hours')
    case '/admin/bundle-to-customer':
      return path.startsWith('/admin/bundle-to-customer')
    default:
      return false
  }
}

function navLinkClassName(isActive: boolean, mobile: boolean): string {
  const base = mobile
    ? 'block w-full px-3 py-2 text-sm font-medium rounded-md'
    : 'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md min-h-[2.75rem]'
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
    fetchProjectsBadge()
  }, [isLoggedIn, userRole, pathname, fetchProjectsBadge])

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'EMPLOYEE') return undefined
    const handler = () => fetchProjectsBadge()
    window.addEventListener(PROJECTS_BADGE_EVENT, handler)
    return () => window.removeEventListener(PROJECTS_BADGE_EVENT, handler)
  }, [isLoggedIn, userRole, fetchProjectsBadge])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'EMPLOYEE') return undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchProjectsBadge()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [isLoggedIn, userRole, fetchProjectsBadge])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUserRole(null)
    router.push('/login')
  }

  if (NAV_HIDDEN_PATHS.includes(pathname || '')) {
    return null
  }

  if (!isLoggedIn) {
    return null
  }

  const currentPath = pathname || ''
  const isAdmin = userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR'

  const navLinks = (
    <>
      {hasDashboardNav(userRole) && (
        <AppNavLink href="/dashboard" pathname={currentPath}>
          {t('nav.dashboard')}
        </AppNavLink>
      )}
      {isAdmin && (
        <AppNavLink href="/admin" pathname={currentPath}>
          {t('nav.admin')}
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
      {userRole === 'EMPLOYEE' && (
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
      {isAdmin && (
        <>
          <AppNavLink href="/create-project" pathname={currentPath}>
            Projekt
          </AppNavLink>
          <AppNavLink href="/admin/my-staff" pathname={currentPath}>
            Personal
          </AppNavLink>
          <AppNavLink href="/admin/payroll-hours" pathname={currentPath}>
            Lön &amp; tid
          </AppNavLink>
          <AppNavLink href="/admin/bundle-to-customer" pathname={currentPath}>
            Till kund
          </AppNavLink>
        </>
      )}
      <AppNavLink href="/my-pages" pathname={currentPath}>
        {t('nav.myPages')}
      </AppNavLink>
    </>
  )

  const mobileNavLinks = (
    <>
      {hasDashboardNav(userRole) && (
        <AppNavLink href="/dashboard" pathname={currentPath} mobile>
          {t('nav.dashboard')}
        </AppNavLink>
      )}
      {isAdmin && (
        <AppNavLink href="/admin" pathname={currentPath} mobile>
          {t('nav.admin')}
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
      {userRole === 'EMPLOYEE' && (
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
      {isAdmin && (
        <>
          <AppNavLink href="/create-project" pathname={currentPath} mobile>
            Projekt
          </AppNavLink>
          <AppNavLink href="/admin/my-staff" pathname={currentPath} mobile>
            Personal
          </AppNavLink>
          <AppNavLink href="/admin/payroll-hours" pathname={currentPath} mobile>
            Lön &amp; tid
          </AppNavLink>
          <AppNavLink href="/admin/bundle-to-customer" pathname={currentPath} mobile>
            Till kund
          </AppNavLink>
        </>
      )}
      <AppNavLink href="/my-pages" pathname={currentPath} mobile>
        {t('nav.myPages')}
      </AppNavLink>
    </>
  )

  return (
    <nav className="bg-white shadow-md" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto pl-1 pr-4 sm:pl-2 sm:pr-6 lg:pl-3 lg:pr-8">
        <div className="py-2">
          <div className="hidden md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-3 min-h-16">
            <div className="inline-flex shrink-0 items-center pr-1 sm:pr-2">
              <Image
                src="/lvtech-logo.png"
                alt="LVtech"
                width={120}
                height={120}
                className="h-10 w-auto md:h-12"
                priority
              />
            </div>

            <div className="flex justify-center min-w-0 px-2" aria-label="Huvudmeny">
              <div className="flex flex-wrap items-stretch justify-center divide-x divide-gray-300">
                {navLinks}
              </div>
            </div>

            <div className="flex items-stretch justify-end shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 min-h-[2.75rem]"
                style={{ color: '#2D5016' }}
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>

          <div className="flex md:hidden items-center min-h-16 gap-2 sm:gap-3">
            <div className="inline-flex shrink-0 items-center pr-1 sm:pr-2">
              <Image
                src="/lvtech-logo.png"
                alt="LVtech"
                width={120}
                height={120}
                className="h-10 w-auto"
                priority
              />
            </div>

            <button
              type="button"
              className="ml-auto inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
              style={{ color: '#2D5016', borderColor: '#D1D5DB' }}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label="Öppna meny"
            >
              {isMobileMenuOpen ? 'Stäng' : 'Meny'}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden mt-2 border-t border-gray-200 pt-2 pb-1 space-y-1">
              {mobileNavLinks}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100"
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