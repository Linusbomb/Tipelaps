'use client'

import { useState } from 'react'

type UnlockTimeReportingButtonProps = {
  userId: string
  month?: string
  reportIds?: string[]
  label?: string
  className?: string
  onUnlocked?: () => void
}

export default function UnlockTimeReportingButton({
  userId,
  month,
  reportIds,
  label = 'Lås upp för komplettering',
  className = '',
  onUnlocked,
}: UnlockTimeReportingButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUnlock = async () => {
    const scope =
      reportIds && reportIds.length === 1
        ? 'denna tidrapport'
        : month
          ? `tidrapportering för ${month}`
          : 'valda tidrapporter'

    const confirmed = window.confirm(
      `Låsa upp ${scope}?\n\nPersonalen kan redigera och måste skicka in på nytt när de är klara.`
    )
    if (!confirmed) return

    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Ingen session')
        return
      }

      const response = await fetch('/api/admin/time-reports/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          ...(month ? { month } : {}),
          ...(reportIds && reportIds.length > 0 ? { reportIds } : {}),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Kunde inte låsa upp')
      }

      const parts: string[] = []
      if (data.timeReportCount > 0) {
        parts.push(`${data.timeReportCount} tidrapport${data.timeReportCount === 1 ? '' : 'er'}`)
      }
      if (data.absenceReportCount > 0) {
        parts.push(`${data.absenceReportCount} frånvarorapport${data.absenceReportCount === 1 ? '' : 'er'}`)
      }
      window.alert(
        parts.length > 0
          ? `Upplåst: ${parts.join(' och ')}. Personalen kan nu komplettera och skicka in igen.`
          : data.message || 'Upplåst.'
      )
      onUnlocked?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={loading}
        className="px-4 py-2 rounded-md border border-amber-700 text-amber-950 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-sm font-medium"
      >
        {loading ? 'Låser upp...' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
