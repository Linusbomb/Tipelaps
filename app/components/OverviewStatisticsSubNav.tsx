'use client'

export type DashboardViewTab = 'overview' | 'statistics'

type Props = {
  activeTab: DashboardViewTab
  onTabChange: (tab: DashboardViewTab) => void
}

/** Flikar mellan Överblick och Statistik — utan sidnavigering. */
export default function OverviewStatisticsSubNav({ activeTab, onTabChange }: Props) {
  const base =
    'inline-flex px-4 py-2 rounded-md text-sm font-medium transition-colors border cursor-pointer'
  const inactive =
    'text-gray-700 border-gray-200 bg-white hover:bg-gray-50 hover:border-green-900/25'
  const active = 'text-white border-transparent shadow-sm'

  return (
    <nav
      className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200"
      aria-label="Överblick och statistik"
    >
      <button
        type="button"
        onClick={() => onTabChange('overview')}
        className={`${base} ${activeTab === 'overview' ? active : inactive}`}
        style={activeTab === 'overview' ? { backgroundColor: '#2D5016' } : undefined}
        aria-current={activeTab === 'overview' ? 'page' : undefined}
      >
        Överblick
      </button>
      <button
        type="button"
        onClick={() => onTabChange('statistics')}
        className={`${base} ${activeTab === 'statistics' ? active : inactive}`}
        style={activeTab === 'statistics' ? { backgroundColor: '#2D5016' } : undefined}
        aria-current={activeTab === 'statistics' ? 'page' : undefined}
      >
        Statistik
      </button>
    </nav>
  )
}
