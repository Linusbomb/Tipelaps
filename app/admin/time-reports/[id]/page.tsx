'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import HoursInput from '@/app/components/HoursInput'
import OvertimeSummary from '@/app/components/OvertimeSummary'
import { computeOvertimeHours } from '@/lib/overtime'

const MACHINE_OPTIONS = [
  'Hjullastare',
  'Grävmaskin',
  'Minigrävare',
  'Dumper',
  'Lastbil',
  'Kranbil',
  'Vält',
  'Annat',
]

type Customer = { id: string; name: string }

type EntryRow = {
  id?: string
  hours: number
  machineHours: number | null
  machineType: string
  registrationNumber: string
  description: string
  /** Valfritt; följer databas om satt tidigare */
  location: string
  referenceNumber: string
}

function parseVehicleCombined(vehicle: string | null | undefined): { type: string; reg: string } {
  if (!vehicle || !vehicle.trim()) return { type: '', reg: '' }
  const m = vehicle.trim().match(/^(.+?) \(([^)]+)\)\s*$/)
  if (m) return { type: m[1].trim(), reg: m[2].trim() }
  return { type: vehicle.trim(), reg: '' }
}

function entryFromApi(en: any): EntryRow {
  let machineType = ''
  let registrationNumber = ''
  if (en.vehicle) {
    const p = parseVehicleCombined(en.vehicle)
    machineType = p.type
    registrationNumber = p.reg
    if (machineType && !MACHINE_OPTIONS.includes(machineType)) {
      registrationNumber = [machineType, registrationNumber].filter(Boolean).join(' ').trim()
      machineType = 'Annat'
    }
  }
  return {
    id: en.id,
    hours: Number(en.hours) || 0,
    machineHours:
      en.machineHours !== null && en.machineHours !== undefined ? Number(en.machineHours) : null,
    machineType,
    registrationNumber,
    description: en.description || '',
    location: en.location || '',
    referenceNumber: en.referenceNumber || '',
  }
}

export default function AdminTimeReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const reportId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [employeeName, setEmployeeName] = useState('')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')
  const [date, setDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [missingHoursReason, setMissingHoursReason] = useState('')
  const [buyerReference, setBuyerReference] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [newCustomerName, setNewCustomerName] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  const totalHours = useMemo(() => entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0), [entries])
  const totalMachineHours = useMemo(
    () => entries.reduce((sum, e) => sum + (e.machineHours && e.machineHours > 0 ? e.machineHours : 0), 0),
    [entries]
  )
  const remainingHours = useMemo(() => Math.max(0, totalHours - totalMachineHours), [totalHours, totalMachineHours])
  const overtimeHours = useMemo(() => computeOvertimeHours(totalHours), [totalHours])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reportId
  }, [reportId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const [reportRes, customersRes] = await Promise.all([
        fetch(`/api/admin/time-reports/${reportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const reportData = await reportRes.json()
      if (!reportRes.ok) throw new Error(reportData.error || 'Kunde inte hämta tidrapport')

      if (customersRes.ok) {
        const customerData = await customersRes.json()
        setCustomers(customerData)
      }

      setEmployeeName(reportData.user?.name || '')
      setStatus(reportData.status || '')
      setCustomerId(reportData.customerId || '')
      setMissingHoursReason(reportData.missingHoursReason || '')
      setBuyerReference(
        typeof reportData.buyerReference === 'string' ? reportData.buyerReference : ''
      )
      const d = new Date(reportData.date)
      setDate(d.toISOString().split('T')[0])
      setMonth(reportData.month || '')

      const rows = (reportData.entries || []).map(entryFromApi)
      setEntries(
        rows.length > 0
          ? rows
          : [{ hours: 0, machineHours: null, machineType: '', registrationNumber: '', description: '', location: '', referenceNumber: '' }]
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  const updateEntry = (index: number, patch: Partial<EntryRow>) => {
    setEntries((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        hours: 0,
        machineHours: null,
        machineType: '',
        registrationNumber: '',
        description: '',
        location: '',
        referenceNumber: '',
      },
    ])
  }

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const saveReport = async () => {
    try {
      setSaving(true)
      setError('')
      setMessage('')

      if (remainingHours > 0 && !missingHoursReason.trim()) {
        setError(`Fyll i förklaring för ${remainingHours.toFixed(1)} h som inte redovisas som fordonstid (samma krav som för personal).`)
        return
      }

      const missingRegForChosenVehicle = entries.find(
        (e) => !!(e.machineType && String(e.machineType).trim()) && !e.registrationNumber.trim()
      )
      if (missingRegForChosenVehicle) {
        setError('Reg.nr måste anges på raden om fordon väljs (samma krav som för personal).')
        return
      }
      const regWithoutVehicle = entries.find(
        (e) => !(e.machineType && String(e.machineType).trim()) && !!e.registrationNumber.trim()
      )
      if (regWithoutVehicle) {
        setError('Välj fordon eller ta bort reg.nr på alla rader.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/admin/time-reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          customerId,
          missingHoursReason: remainingHours > 0 ? missingHoursReason : null,
          buyerReference: buyerReference.trim() || null,
          entries: entries.map((e) => ({
            hours: e.hours,
            machineHours: e.machineHours,
            machineType: e.machineType,
            registrationNumber: e.registrationNumber,
            description: e.description,
            location: e.location,
            referenceNumber: e.referenceNumber,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kunde inte spara tidrapport')
      setMessage('Tidrapport uppdaterad')
      setStatus(data.status || status)
      if (data.month) setMonth(data.month)
      if (data.entries) setEntries((data.entries as any[]).map(entryFromApi))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSaving(false)
    }
  }

  const approveReport = async () => {
    try {
      setApproving(true)
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/admin/time-reports/${reportId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kunde inte godkänna tidrapport')
      setStatus('APPROVED')
      setMessage('Tidrapport godkänd')
      router.push('/admin')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setApproving(false)
    }
  }

  const createCustomer = async () => {
    const name = newCustomerName.trim()
    if (!name) {
      setError('Fyll i kundnamn')
      return
    }

    try {
      setCreatingCustomer(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kunde inte skapa kund')

      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')))
      setCustomerId(data.id)
      setNewCustomerName('')
      setMessage('Ny kund skapad')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setCreatingCustomer(false)
    }
  }

  if (loading) return <div className="p-8">Laddar tidrapport...</div>

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card max-w-4xl mx-auto">
        <button onClick={() => router.push('/admin')} className="mb-4 underline" style={{ color: '#2D5016' }}>
          ← Tillbaka till admin
        </button>
        <h1 className="app-title mb-1" style={{ color: '#2D5016' }}>
          Tidrapport
        </h1>
        <p className="mb-2 text-sm text-gray-600">
          Anställd: <span className="font-medium text-gray-900">{employeeName}</span> · Status:{' '}
          <span className="font-medium text-gray-900">{status}</span>
          {month ? (
            <>
              {' '}
              · Månad: <span className="font-medium text-gray-900">{month}</span>
            </>
          ) : null}
        </p>
        <p className="mb-6 text-xs text-gray-500">
          Visningen följer personalens upplägg: timmar och beskrivning per rad, valfria fordonstimmar, valfritt fordon och
          reg.nr (bara om fordon väljs). Förklaring krävs när mer arbetats än vad som anges som fordonstimmar.
        </p>

        {error && <p className="mb-4 text-red-600">{error}</p>}
        {message && <p className="mb-4 text-green-700">{message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kund</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Välj kund</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Skapa ny kund"
                className="w-full px-3 py-2 border rounded-md"
              />
              <button
                onClick={createCustomer}
                type="button"
                disabled={creatingCustomer}
                className="px-3 py-2 rounded-md text-white disabled:opacity-50 shrink-0"
                style={{ backgroundColor: '#2D5016' }}
              >
                {creatingCustomer ? 'Skapar...' : 'Skapa ny kund'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="admin-buyer-reference" className="block text-sm font-medium mb-1">
            Beställarens referens <span className="font-normal text-gray-500">(valfritt)</span>
          </label>
          <input
            id="admin-buyer-reference"
            type="text"
            value={buyerReference}
            onChange={(e) => setBuyerReference(e.target.value)}
            className="w-full px-3 py-2 border rounded-md max-w-xl"
            placeholder="T.ex. ordernummer från personal/kund"
            maxLength={500}
            autoComplete="off"
          />
        </div>

        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-1">
          <p className="text-lg font-semibold text-gray-900">Totalt arbetstid: {totalHours.toFixed(1)} timmar</p>
          <p className="text-sm text-gray-700">Totalt fordonstid: {totalMachineHours.toFixed(1)} timmar</p>
          <OvertimeSummary overtimeHours={overtimeHours} />
          {remainingHours > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-orange-700 font-medium">
                Resterande tid utan fordon: {remainingHours.toFixed(1)} timmar
              </p>
              <div className="pt-2 border-t border-orange-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Personalens förklaring</p>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                  {missingHoursReason?.trim() ? missingHoursReason : '—'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Arbetstid och fordonstid balanserar; ingen motivtext krävs.</p>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold" style={{ color: '#2D5016' }}>
              Fordonstimmar / aktiviteter
            </h2>
            <button onClick={addEntry} type="button" className="px-3 py-2 rounded-md text-white text-sm" style={{ backgroundColor: '#2D5016' }}>
              + Lägg till aktivitet
            </button>
          </div>
          <div className="space-y-4">
            {entries.map((entry, index) => (
              <div key={entry.id || index} className="p-4 border border-gray-200 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Timmar (arbete)</label>
                    <HoursInput
                      value={entry.hours}
                      onChange={(hours) => updateEntry(index, { hours: hours ?? 0 })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fordonstimmar (valfritt)</label>
                    <HoursInput
                      optional
                      value={entry.machineHours}
                      onChange={(machineHours) => updateEntry(index, { machineHours })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Fordon <span className="font-normal text-gray-500">(valfritt)</span>
                    </label>
                    <select
                      value={entry.machineType}
                      onChange={(e) => updateEntry(index, { machineType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Välj fordon</option>
                      {MACHINE_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Reg.nr <span className="font-normal text-gray-400">(om fordon saknas lämna tomt)</span>
                    </label>
                    <input
                      type="text"
                      value={entry.registrationNumber}
                      onChange={(e) => updateEntry(index, { registrationNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Krävs bara om ett fordon valts"
                      required={!!(entry.machineType && entry.machineType.trim())}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivning</label>
                  <textarea
                    value={entry.description}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plats (valfritt, för admin)</label>
                    <input
                      type="text"
                      value={entry.location}
                      onChange={(e) => updateEntry(index, { location: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-gray-50/50"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Referens (valfritt, för admin)</label>
                    <input
                      type="text"
                      value={entry.referenceNumber}
                      onChange={(e) => updateEntry(index, { referenceNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-gray-50/50"
                      placeholder="—"
                    />
                  </div>
                </div>
                {entries.length > 1 && (
                  <button type="button" onClick={() => removeEntry(index)} className="text-sm text-red-600 underline">
                    Ta bort aktivitet
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-1">
            <p className="text-lg font-semibold text-gray-900">
              Totalt arbetstid: {totalHours.toFixed(1)} timmar
            </p>
            <p className="text-sm text-gray-700">
              Totalt fordonstid: {totalMachineHours.toFixed(1)} timmar
            </p>
            <OvertimeSummary overtimeHours={overtimeHours} />
            {remainingHours > 0 && (
              <p className="text-sm text-orange-700 font-medium mt-1">
                Resterande tid utan fordon: {remainingHours.toFixed(1)} timmar
              </p>
            )}
          </div>
        </div>

        {remainingHours > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Förklara resterande tid (obligatorisk)</label>
            <textarea
              value={missingHoursReason}
              onChange={(e) => setMissingHoursReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
              placeholder='Till exempel: "städat garaget", "service av fordon"...'
              required={remainingHours > 0}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={saveReport}
            disabled={saving}
            className="px-4 py-2 text-white rounded-md disabled:opacity-50"
            style={{ backgroundColor: '#2D5016' }}
          >
            {saving ? 'Sparar...' : 'Spara ändringar'}
          </button>
          <button
            onClick={approveReport}
            disabled={approving}
            className="px-4 py-2 rounded-md border border-green-700 text-green-800 hover:bg-green-50 disabled:opacity-50"
          >
            {approving ? 'Godkänner...' : 'Godkänn tidrapport'}
          </button>
        </div>
      </div>
    </div>
  )
}
