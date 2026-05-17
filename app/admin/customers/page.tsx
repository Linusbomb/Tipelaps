'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function AdminCustomersPage() {
  const { t } = useLanguage()
  
  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        <h1 className="app-title mb-6" style={{ color: '#2D5016' }}>
          Kunder
        </h1>
        <p>Kundhantering</p>
      </div>
    </div>
  )
}