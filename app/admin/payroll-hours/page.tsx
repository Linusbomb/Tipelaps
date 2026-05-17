'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Row {
  id: string
  name: string
  email: string
  inskickadeTimmar: number
  godkandaTimmar: number
  rapportCountInskickad: number
  rapportCountGodkand: number
}

interface Summary {
  month: string
  employees: Row[]
  totals: { inskickadeTimmar: number; godkandaTimmar: number }
}

function monthLabelSv(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  return new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(d)
}

export default function PayrollHoursPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [companyStartYear, setCompanyStartYear] = useState(new Date().getFullYear())
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(now.getMonth())
  const [exporting, setExporting] = useState(false)
  const [copyDone, setCopyDone] = useState(false)

  const ym = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch(`/api/admin/payroll/monthly-summary?month=${encodeURIComponent(ym)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      } else {
        setSummary(null)
      }
    } finally {
      setSummaryLoading(false)
    }
  }, [ym])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    if (!token || !raw) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (parsed.role !== 'ENTREPRENEUR' && parsed.role !== 'PAYROLL_COORDINATOR') {
        router.push('/time-report')
        return
      }
      setUser({ name: parsed.name, role: parsed.role })

      fetch('/api/company/logo', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((companyData) => {
          if (companyData?.companyCreatedAt) {
            const y = new Date(companyData.companyCreatedAt).getFullYear()
            if (!Number.isNaN(y)) setCompanyStartYear(y)
          }
        })
        .catch(() => {})
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
      return
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchSummary()
  }, [user, fetchSummary])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const downloadExport = async (mode: 'payroll' | 'with_pending') => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      setExporting(true)
      const res = await fetch(
        `/api/admin/payroll/export-monthly?month=${encodeURIComponent(ym)}&mode=${encodeURIComponent(mode)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        alert('Kunde inte skapa exportfilen.')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `loneunderlag-${ym}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const copyTable = async () => {
    if (!summary) return
    const header =
      ['Namn', 'E-post', 'Inskickade timmar', 'Godkända timmar', 'Antal rapporter (insk.)', 'Antal godkända'].join(
        '\t'
      )
    const lines = summary.employees.map(
      (e) =>
        `${e.name}\t${e.email}\t${e.inskickadeTimmar}\t${e.godkandaTimmar}\t${e.rapportCountInskickad}\t${e.rapportCountGodkand}`
    )
    const text = `${header}\n${lines.join('\n')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      alert('Kunde inte kopiera. Markera tabellen manuellt.')
    }
  }

  const endYear = now.getFullYear() + 2
  const yearOptions = Array.from({ length: endYear - companyStartYear + 1 }, (_, i) => companyStartYear + i).reverse()

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(new Date(2026, i, 1))
  )

  if (loading || !user) {
    return <div className="p-8">Laddar...</div>
  }

  return (
    <div className="app-shell-wide">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="app-title text-gray-900">Arbetstid för lön</h1>
          <p className="text-gray-600 mt-1">
            Totalt antal timmar per anställd per månad och enkel CSV-export till lönesystem.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-gray-700">Hej, {user.name}!</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logga ut
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Välj månad</h2>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">År</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md min-w-[120px]"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Månad</label>
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md min-w-[160px]"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:pb-0.5">
            <button
              type="button"
              disabled={exporting || summaryLoading}
              onClick={() => downloadExport('payroll')}
              className="px-5 py-2.5 rounded-md text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {exporting ? 'Exporterar…' : 'Exportera till lönesystem (CSV)'}
            </button>
            <button
              type="button"
              disabled={summaryLoading || !summary}
              onClick={copyTable}
              className="px-4 py-2.5 rounded-md border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {copyDone ? 'Kopierat ✓' : 'Kopiera tabell'}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          CSV-filen sammanställer <strong>endast godkända</strong> tidrapporter (lämpligt för löneunderlag).
          Behöver du även väntande rapporter, använd &quot;Exportera väntande + godkänd&quot; nedan.
        </p>
        <button
          type="button"
          disabled={exporting || summaryLoading}
          onClick={() => downloadExport('with_pending')}
          className="mt-2 text-sm font-medium underline disabled:opacity-50"
          style={{ color: '#2D5016' }}
        >
          Exportera väntande + godkänd (CSV)
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Summering · {monthLabelSv(ym)}</h2>
        </div>
        {summaryLoading ? (
          <div className="p-8 text-center text-gray-600">Laddar…</div>
        ) : !summary ? (
          <div className="p-8 text-gray-500">Kunde inte ladda data.</div>
        ) : summary.employees.length === 0 ? (
          <div className="p-8 text-gray-500">Ingen personal hittades.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Namn
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    E-post
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Timmar inskickade*
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Timmar godkända
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Rapporter
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{e.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                      {e.inskickadeTimmar.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums" style={{ color: '#2D5016' }}>
                      {e.godkandaTimmar.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {e.rapportCountGodkand}/{e.rapportCountInskickad}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900">
                    Summa alla anställda
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums">
                    {summary.totals.inskickadeTimmar.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums" style={{ color: '#2D5016' }}>
                    {summary.totals.godkandaTimmar.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {/* leave blank */}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {summary && !summaryLoading ? (
          <p className="px-6 py-3 text-xs text-gray-500 border-t border-gray-100">
            * Timmar för inskickade rapporter inkluderar månader som skickats in till dig men inte hunnit godkännas
            ännu.
          </p>
        ) : null}
      </div>
    </div>
  )
}
