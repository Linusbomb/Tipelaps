'use client'

import { useEffect, useState } from 'react'

const KEY_TOKEN = 'token'
const KEY_USER = 'user'
const KEY_SUPER_TOKEN = 'superadminToken'
const KEY_SUPER_USER = 'superadminUser'
const KEY_AS_USER = 'impersonatedAs'

type ImpersonationInfo = {
  superEmail: string
  asEmail: string
  asName: string
  companyName?: string
}

export default function ImpersonationBanner() {
  const [info, setInfo] = useState<ImpersonationInfo | null>(null)

  useEffect(() => {
    function refresh() {
      try {
        const raw = localStorage.getItem(KEY_AS_USER)
        if (!raw) {
          setInfo(null)
          return
        }
        const parsed = JSON.parse(raw) as ImpersonationInfo
        setInfo(parsed)
      } catch {
        setInfo(null)
      }
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  function returnToSuperAdmin() {
    const superToken = localStorage.getItem(KEY_SUPER_TOKEN)
    const superUser = localStorage.getItem(KEY_SUPER_USER)
    if (superToken && superUser) {
      localStorage.setItem(KEY_TOKEN, superToken)
      localStorage.setItem(KEY_USER, superUser)
    } else {
      localStorage.removeItem(KEY_TOKEN)
      localStorage.removeItem(KEY_USER)
    }
    localStorage.removeItem(KEY_SUPER_TOKEN)
    localStorage.removeItem(KEY_SUPER_USER)
    localStorage.removeItem(KEY_AS_USER)
    window.location.href = '/superadmin'
  }

  if (!info) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm shadow"
      style={{ backgroundColor: '#FEF3C7', color: '#7C4A03', borderBottom: '1px solid #F59E0B' }}
    >
      <div>
        <strong>Inloggad som kund:</strong> {info.asName} ({info.asEmail})
        {info.companyName ? ` – ${info.companyName}` : ''}
        <span className="ml-2 text-xs opacity-70">via superadmin {info.superEmail}</span>
      </div>
      <button
        type="button"
        onClick={returnToSuperAdmin}
        className="rounded-md bg-yellow-700 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-800"
      >
        ← Återgå till superadmin
      </button>
    </div>
  )
}
