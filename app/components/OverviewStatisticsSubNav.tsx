'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Undermeny mellan Överblick och Statistik (visas högst upp på båda sidorna). */
export default function OverviewStatisticsSubNav() {
  const pathname = usePathname() || ''
  const onDashboard = pathname === '/dashboard'
  const onStatistics = pathname === '/statistics'

  const base =
    'inline-flex px-4 py-2 rounded-md text-sm font-medium transition-colors border'
  const inactive =
    'text-gray-700 border-gray-200 bg-white hover:bg-gray-50 hover:border-green-900/25'
  const active = 'text-white border-transparent shadow-sm'

  return (
    <nav
      className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200"
      aria-label="Överblick och statistik"
    >
      <Link
        href="/dashboard"
        className={`${base} ${onDashboard ? active : inactive}`}
        style={onDashboard ? { backgroundColor: '#2D5016' } : undefined}
        aria-current={onDashboard ? 'page' : undefined}
      >
        Överblick
      </Link>
      <Link
        href="/statistics"
        className={`${base} ${onStatistics ? active : inactive}`}
        style={onStatistics ? { backgroundColor: '#2D5016' } : undefined}
        aria-current={onStatistics ? 'page' : undefined}
      >
        Statistik
      </Link>
    </nav>
  )
}
