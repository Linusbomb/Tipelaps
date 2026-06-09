'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/admin/vehicles',
    label: 'Fordonsregister',
    isActive: (path: string) => path === '/admin/vehicles',
  },
  {
    href: '/admin/vehicles/timmar',
    label: 'Fordonsstatistik',
    isActive: (path: string) => path.startsWith('/admin/vehicles/timmar'),
  },
] as const

export default function AdminVehiclesSubNav() {
  const pathname = (usePathname() || '').split('?')[0]
  const base =
    'inline-flex px-4 py-2 rounded-md text-sm font-medium transition-colors border'
  const inactive =
    'text-gray-700 border-gray-200 bg-white hover:bg-gray-50 hover:border-green-900/25'
  const active = 'text-white border-transparent shadow-sm'

  return (
    <nav
      className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200"
      aria-label="Fordon"
    >
      {tabs.map((tab) => {
        const isActive = tab.isActive(pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${base} ${isActive ? active : inactive}`}
            style={isActive ? { backgroundColor: '#2D5016' } : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
