'use client'

import Link from 'next/link'
import AdminVehiclesSubNav from '@/app/components/AdminVehiclesSubNav'

export default function AdminVehiclesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell-wide" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#2D5016' }}>
              Fordon
            </h1>
            <p className="text-sm text-gray-600">
              Registrera företagets fordon och följ godkända fordonstimmar per månad, vecka eller år.
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Till admin
          </Link>
        </div>
        <AdminVehiclesSubNav />
        {children}
      </div>
    </div>
  )
}
