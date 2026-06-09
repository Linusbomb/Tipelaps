'use client'

import { useEffect, useMemo, useState } from 'react'
import { toMonthKey } from '@/lib/monthReporting'
import { buildVehiclePeriodOptions, currentIsoWeekKey } from '@/lib/vehicleHours'

type HoursRow = {
  vehicleId: string | null
  label: string
  typeLabel: string
  registrationNumber: string
  totalHours: number
  entryCount: number
}

type PeriodKind = 'month' | 'week' | 'year'

export default function AdminVehicleHoursPage() {
  const periodOptions = useMemo(() => buildVehiclePeriodOptions(), [])
  const [period, setPeriod] = useState<PeriodKind>('month')
  const [monthValue, setMonthValue] = useState(toMonthKey(new Date()))
  const [weekValue, setWeekValue] = useState(currentIsoWeekKey())
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grandTotal, setGrandTotal] = useState(0)
  const [rows, setRows] = useState<HoursRow[]>([])

  const value =
    period === 'month' ? monthValue : period === 'week' ? weekValue : yearValue

  const token = () => localStorage.getItem('token') || ''

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ period, value })
        const res = await fetch(`/api/admin/vehicles/hours?${params}`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Kunde inte hämta statistik')
        if (cancelled) return
        setGrandTotal(Number(data.grandTotal) || 0)
        setRows(Array.isArray(data.rows) ? data.rows : [])
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kunde inte hämta statistik')
          setRows([])
          setGrandTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [period, value])

  const visibleRows = rows.filter((row) => row.totalHours > 0)

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Timmar räknas från <strong>godkända</strong> tidrapporter med registrerade fordonstimmar.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKind)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="month">Månad</option>
            <option value="week">Vecka</option>
            <option value="year">År</option>
          </select>
        </div>
        {period === 'month' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Månad</label>
            <select
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {periodOptions.months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {period === 'week' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vecka</label>
            <select
              value={weekValue}
              onChange={(e) => setWeekValue(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {periodOptions.weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {period === 'year' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">År</label>
            <select
              value={yearValue}
              onChange={(e) => setYearValue(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {periodOptions.years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="mb-4 rounded-md border border-green-900/20 bg-green-50/70 px-4 py-3">
        <span className="text-sm text-gray-700">Totalt fordonstimmar: </span>
        <span className="text-lg font-semibold" style={{ color: '#2D5016' }}>
          {loading ? '…' : `${grandTotal.toFixed(1)} h`}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Laddar statistik…</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-gray-600">Inga godkända fordonstimmar för vald period.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Fordon</th>
                <th className="px-4 py-3 font-medium text-gray-700">Typ</th>
                <th className="px-4 py-3 font-medium text-gray-700">Reg.nr</th>
                <th className="px-4 py-3 font-medium text-gray-700 text-right">Timmar</th>
                <th className="px-4 py-3 font-medium text-gray-700 text-right">Rader</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleRows.map((row) => (
                <tr key={row.vehicleId ?? row.label} className="bg-white">
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="px-4 py-3">{row.typeLabel}</td>
                  <td className="px-4 py-3">{row.registrationNumber || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{row.totalHours.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.entryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
