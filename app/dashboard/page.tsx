'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import Link from 'next/link'
import OverviewStatisticsSubNav from '@/app/components/OverviewStatisticsSubNav'

type Employee = {
  id: string
  name: string
  email: string
}

export default function DashboardPage() {
  const { t } = useLanguage()
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(new Date())
  const [showMonthModal, setShowMonthModal] = useState(false)
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState({
    totalReports: 0,
    totalHours: 0,
    pendingApprovals: 0,
  })
  const [loading, setLoading] = useState(true)
  const selectedMonth = selectedMonthDate
    ? `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 7)

  useEffect(() => {
    fetchStats()
  }, [selectedMonth])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch(`/api/admin/time-reports?status=ALL&month=${selectedMonth}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (response.ok) {
        const reports = await response.json()
        setStats({
          totalReports: reports.length,
          totalHours: reports.reduce((sum: number, r: any) => sum + r.totalHours, 0),
          pendingApprovals: reports.filter((r: any) => r.status === 'SUBMITTED').length,
        })
      }
    } catch (error) {
      console.error('Fel vid hämtning av statistik:', error)
    } finally {
      setLoading(false)
    }
  }

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('sv-SE', {
    month: 'long',
  })
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  const monthNames = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]

  const openMonthPicker = () => {
    if (selectedMonthDate) {
      setPickerYear(selectedMonthDate.getFullYear())
    }
    setShowMonthModal(true)
  }

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        <OverviewStatisticsSubNav />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="app-title" style={{ color: '#2D5016' }}>
            Överblick {capitalizedMonthLabel}
          </h1>
          <button
            type="button"
            onClick={openMonthPicker}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-left md:min-w-[220px] shadow-sm"
          >
            Välj månad: {capitalizedMonthLabel} {selectedMonthDate?.getFullYear()}
          </button>
        </div>

        {loading ? (
          <p>Laddar...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Totalt antal rapporter</h3>
              <p className="text-3xl font-bold">{stats.totalReports}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Totalt antal timmar</h3>
              <p className="text-3xl font-bold">{stats.totalHours.toFixed(1)} h</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Väntar på godkännande</h3>
              <p className="text-3xl font-bold">{stats.pendingApprovals}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Link
            href="/admin"
            className="w-full sm:w-auto text-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Gå till Admin
          </Link>
          <Link
            href="/time-report"
            className="w-full sm:w-auto text-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Skapa tidrapport
          </Link>
        </div>
      </div>

      {showMonthModal && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setPickerYear((prev) => prev - 1)}
                className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                ‹
              </button>
              <h2 className="text-lg font-semibold" style={{ color: '#2D5016' }}>
                Välj månad ({pickerYear})
              </h2>
              <button
                type="button"
                onClick={() => setPickerYear((prev) => prev + 1)}
                className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-5">
              {monthNames.map((name, index) => {
                const isSelected =
                  selectedMonthDate?.getFullYear() === pickerYear &&
                  selectedMonthDate?.getMonth() === index

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedMonthDate(new Date(pickerYear, index, 1))
                      setShowMonthModal(false)
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium border transition ${
                      isSelected
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-green-50 hover:border-green-300'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>

            <div className="px-5 pb-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}