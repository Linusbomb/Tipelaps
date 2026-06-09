'use client'

import Link from 'next/link'
import AdminCustomersSubNav from '@/app/components/AdminCustomersSubNav'

export default function AdminCustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell-wide" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#2D5016' }}>
              Kunder
            </h1>
            <p className="text-sm text-gray-600">
              Hantera kunder och skicka tidrapporter under fliken Till kund.
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Till admin
          </Link>
        </div>
        <AdminCustomersSubNav />
        {children}
      </div>
    </div>
  )
}
