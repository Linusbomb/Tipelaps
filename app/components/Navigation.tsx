'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { decodeJwtPayload } from '@/lib/decodeJwtPayload'

const PROJECTS_BADGE_EVENT = 'projects-badge-refresh'

const NAV_HIDDEN_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password']

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

  /** Gemensamt utseende; vertikala streck med divide-x mellan sibling-länkar. */
  const navLinkClass =
    'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-100 min-h-[2.75rem]'
  const mobileNavLinkClass =
    'block w-full px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100'
  const navLinkStyle = { color: '#2D5016' } as const

  return (
    <nav className="bg-white shadow-md" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-2">
          <div className="flex items-center min-h-16 gap-3">
            <Link
              href="/"
              className="group inline-flex shrink-0 items-center transition-all duration-200"
            >
              <Image
                src="/lvtech-logo.png"
                alt="LVtech"
                width={120}
                height={120}
                className="h-10 w-auto md:h-12"
                priority
              />
            </Link>

            <div className="hidden md:flex flex-1 justify-start">
              <div className="flex flex-wrap items-stretch divide-x divide-gray-300">
                {(userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR') && (
                  <Link href="/admin" className={navLinkClass} style={navLinkStyle}>
                    {t('nav.admin')}
                  </Link>
                )}
                <Link href="/time-report" className={navLinkClass} style={navLinkStyle}>
                  {t('nav.timeReport')}
                </Link>
                {userRole === 'EMPLOYEE' && (
                  <Link href="/my-reports" className={navLinkClass} style={navLinkStyle}>
                    {t('nav.myReports')}
                  </Link>
                )}
                {userRole === 'EMPLOYEE' && (
                  <Link href="/my-projects" className={`${navLinkClass} gap-2`} style={navLinkStyle}>
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
                  </Link>
                )}
                {(userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR') && (
                  <>
                    <Link href="/create-project" className={navLinkClass} style={navLinkStyle}>
                      Projekt
                    </Link>
                    <Link href="/admin/my-staff" className={navLinkClass} style={navLinkStyle}>
                      Personal
                    </Link>
                    <Link href="/statistics" className={navLinkClass} style={navLinkStyle}>
                      Statistik
                    </Link>
                    <Link href="/admin/payroll-hours" className={navLinkClass} style={navLinkStyle}>
                      Lön &amp; tid
                    </Link>
                    <Link href="/admin/bundle-to-customer" className={navLinkClass} style={navLinkStyle}>
                      Till kund
                    </Link>
                  </>
                )}
                <Link href="/my-pages" className={navLinkClass} style={navLinkStyle}>
                  {t('nav.myPages')}
                </Link>
              </div>
            </div>

            <div className="hidden md:flex items-stretch shrink-0 ml-auto">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 min-h-[2.75rem]"
                style={{ color: '#2D5016' }}
              >
                {t('nav.logout')}
              </button>
            </div>

            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
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
              {(userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR') && (
                <Link href="/admin" className={mobileNavLinkClass} style={navLinkStyle}>
                  {t('nav.admin')}
                </Link>
              )}
              <Link href="/time-report" className={mobileNavLinkClass} style={navLinkStyle}>
                {t('nav.timeReport')}
              </Link>
              {userRole === 'EMPLOYEE' && (
                <Link href="/my-reports" className={mobileNavLinkClass} style={navLinkStyle}>
                  {t('nav.myReports')}
                </Link>
              )}
              {userRole === 'EMPLOYEE' && (
                <Link href="/my-projects" className={`${mobileNavLinkClass} flex items-center justify-between`} style={navLinkStyle}>
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
                </Link>
              )}
              {(userRole === 'ENTREPRENEUR' || userRole === 'PAYROLL_COORDINATOR') && (
                <>
                  <Link href="/create-project" className={mobileNavLinkClass} style={navLinkStyle}>
                    Projekt
                  </Link>
                  <Link href="/admin/my-staff" className={mobileNavLinkClass} style={navLinkStyle}>
                    Personal
                  </Link>
                  <Link href="/statistics" className={mobileNavLinkClass} style={navLinkStyle}>
                    Statistik
                  </Link>
                  <Link href="/admin/payroll-hours" className={mobileNavLinkClass} style={navLinkStyle}>
                    Lön &amp; tid
                  </Link>
                  <Link href="/admin/bundle-to-customer" className={mobileNavLinkClass} style={navLinkStyle}>
                    Till kund
                  </Link>
                </>
              )}
              <Link href="/my-pages" className={mobileNavLinkClass} style={navLinkStyle}>
                {t('nav.myPages')}
              </Link>
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