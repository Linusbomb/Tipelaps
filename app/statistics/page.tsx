'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Statistik finns inbäddad på dashboard — behåll URL för bokmärken. */
export default function StatisticsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard?tab=statistics')
  }, [router])

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        <p className="text-gray-700">Öppnar statistik…</p>
      </div>
    </div>
  )
}
