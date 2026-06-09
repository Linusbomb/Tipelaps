'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clearLocalSession } from '@/lib/session'

const PRIMARY = '#2D5016'

type SessionUser = {
  id: string
  name: string
  email: string
  role: string
}

type SuperAdminShellProps = {
  user: SessionUser
  children: React.ReactNode
}

function navTabClass(active: boolean): string {
  const base =
    'rounded-md px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap'
  return active
    ? `${base} text-white shadow-sm`
    : `${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`
}

export default function SuperAdminShell({ user, children }: SuperAdminShellProps) {
  const pathname = usePathname() || ''
  const onCustomers =
    pathname === '/superadmin' || pathname.startsWith('/superadmin/companies/')
  const onAudit = pathname.startsWith('/superadmin/audit')

  function handleLogout() {
    clearLocalSession()
    window.location.href = '/login?type=admin'
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2D5016]/70">
              TimeLaps administration
            </p>
            <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
              Superadmin
            </h1>
            <p className="mt-1 text-sm text-gray-700">
              Inloggad som <strong>{user.name}</strong> ({user.email})
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Logga ut
          </button>
        </div>

        <nav
          className="flex flex-wrap gap-2 rounded-xl border border-[#2D5016]/15 bg-white/90 p-2 shadow-sm"
          aria-label="Superadmin-meny"
        >
          <Link
            href="/superadmin"
            className={navTabClass(onCustomers)}
            style={onCustomers ? { backgroundColor: PRIMARY } : undefined}
          >
            Kunder
          </Link>
          <Link
            href="/superadmin/audit"
            className={navTabClass(onAudit)}
            style={onAudit ? { backgroundColor: PRIMARY } : undefined}
          >
            Revisionslogg
          </Link>
        </nav>
      </header>

      {children}
    </div>
  )
}
