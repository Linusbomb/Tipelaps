'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SuccessDialog from '@/app/components/SuccessDialog'
import TimeOfDayInput from '@/app/components/TimeOfDayInput'
import { calculateOvertimeHours } from '@/lib/overtime'

type OvertimeRow = { startTime: string; endTime: string; note: string }

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

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

type EntryRow = {
  hours: number
  description: string
  machineHours: number | null
  machineType: string
  registrationNumber: string
}

function parseVehicle(vehicle: string | null): { machineType: string; registrationNumber: string } {
  if (!vehicle || !vehicle.trim()) return { machineType: '', registrationNumber: '' }
  const m = vehicle.trim().match(/^(.+?) \(([^)]+)\)\s*$/)
  if (m) return { machineType: m[1].trim(), registrationNumber: m[2].trim() }
  return { machineType: 'Annat', registrationNumber: vehicle.trim() }
}

export default function TimeReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [editable, setEditable] = useState(false)
  const [customerDisplayName, setCustomerDisplayName] = useState('')
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([
    { hours: 0, description: '', machineHours: null, machineType: '', registrationNumber: '' },
  ])
  const [missingHoursReason, setMissingHoursReason] = useState('')
  const [buyerReference, setBuyerReference] = useState('')
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const [hasOvertime, setHasOvertime] = useState(false)
  const [overtimeRows, setOvertimeRows] = useState<OvertimeRow[]>([])

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)
  const totalMachineHours = entries.reduce(
    (sum, e) => sum + (e.machineHours && e.machineHours > 0 ? e.machineHours : 0),
    0
  )
  const remainingHours = totalHours - totalMachineHours

  const overtimeRowsForApi = useMemo(
    () =>
      hasOvertime
        ? overtimeRows
            .map((row) => ({
              startTime: row.startTime.trim(),
              endTime: row.endTime.trim(),
              note: row.note.trim(),
            }))
            .filter((row) => row.startTime || row.endTime || row.note)
        : [],
    [hasOvertime, overtimeRows]
  )

  const totalOvertime = useMemo(() => {
    if (!hasOvertime) return 0
    return overtimeRows.reduce((sum, row) => {
      if (!TIME_RE.test(row.startTime) || !TIME_RE.test(row.endTime)) return sum
      const h = calculateOvertimeHours(row.startTime, row.endTime)
      return sum + (Number.isNaN(h) ? 0 : h)
    }, 0)
  }, [hasOvertime, overtimeRows])

  const addOvertimeRow = () =>
    setOvertimeRows((prev) => [...prev, { startTime: '', endTime: '', note: '' }])

  const removeOvertimeRow = (index: number) =>
    setOvertimeRows((prev) => prev.filter((_, i) => i !== index))

  const updateOvertimeRow = (index: number, field: keyof OvertimeRow, value: string) =>
    setOvertimeRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })

  const handleOvertimeToggle = (checked: boolean) => {
    setHasOvertime(checked)
    if (checked && overtimeRows.length === 0) {
      setOvertimeRows([{ startTime: '', endTime: '', note: '' }])
    }
    if (!checked) {
      setOvertimeRows([])
    }
  }

  const loadReport = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const [reportRes, customersRes] = await Promise.all([
        fetch(`/api/time-reports/${reportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/customers', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (reportRes.status === 401) {
        router.push('/login')
        return
      }

      if (!reportRes.ok) {
        const d = await reportRes.json().catch(() => ({}))
        throw new Error(d.error || 'Kunde inte ladda tidrapport')
      }

      const data = await reportRes.json()
      setReportStatus(data.status || '')
      setEditable(Boolean(data.editable))
      setCustomerDisplayName(data.customer?.name || '')
      setSelectedCustomer(data.customer?.id || '')
      const reportDay = new Date(data.date)
      setSelectedDate(reportDay.toISOString().split('T')[0])
      setMissingHoursReason(data.missingHoursReason || '')

      const mapped: EntryRow[] = (data.entries || []).map((en: any) => {
        let machineType = ''
        let registrationNumber = ''
        if (en.vehicle) {
          const p = parseVehicle(en.vehicle)
          machineType = p.machineType
          registrationNumber = p.registrationNumber
          if (machineType && !MACHINE_OPTIONS.includes(machineType)) {
            registrationNumber = [machineType, registrationNumber].filter(Boolean).join(' ').trim()
            machineType = 'Annat'
          }
        }
        return {
          hours: Number(en.hours) || 0,
          description: en.description || '',
          machineHours:
            en.machineHours !== null && en.machineHours !== undefined ? Number(en.machineHours) : null,
          machineType,
          registrationNumber,
        }
      })

      if (mapped.length === 0) {
        mapped.push({
          hours: 0,
          description: '',
          machineHours: null,
          machineType: '',
          registrationNumber: '',
        })
      }

      setEntries(mapped)
      setBuyerReference(typeof data.buyerReference === 'string' ? data.buyerReference : '')

      const overtimeFromApi: OvertimeRow[] = Array.isArray(data.overtimeEntries)
        ? data.overtimeEntries.map((row: any) => ({
            startTime: typeof row.startTime === 'string' ? row.startTime : '',
            endTime: typeof row.endTime === 'string' ? row.endTime : '',
            note: typeof row.note === 'string' ? row.note : '',
          }))
        : []
      setOvertimeRows(overtimeFromApi)
      setHasOvertime(overtimeFromApi.length > 0)

      if (customersRes.ok) {
        setCustomers(await customersRes.json())
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }, [reportId, router])

  useEffect(() => {
    if (reportId) loadReport()
  }, [reportId, loadReport])

  const addEntry = () => {
    setEntries([
      ...entries,
      { hours: 0, description: '', machineHours: null, machineType: '', registrationNumber: '' },
    ])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const updateEntry = (index: number, field: keyof EntryRow, value: unknown) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], [field]: value } as EntryRow
    setEntries(updated)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) {
      alert('Välj en kund')
      return
    }
    if (remainingHours > 0 && !missingHoursReason.trim()) {
      alert(`Du har ${remainingHours.toFixed(1)} timmar utan fordonstid. Fyll i förklaring innan du sparar.`)
      return
    }
    const missingRegForChosenVehicle = entries.find(
      (entry) =>
        !!(entry.machineType && String(entry.machineType).trim()) &&
        !(entry.registrationNumber && entry.registrationNumber.trim())
    )
    if (missingRegForChosenVehicle) {
      alert('Om du väljer fordon måste reg.nr anges på den aktiviteten.')
      return
    }
    const regWithoutVehicle = entries.find(
      (entry) =>
        !(entry.machineType && String(entry.machineType).trim()) &&
        !!(entry.registrationNumber && entry.registrationNumber.trim())
    )
    if (regWithoutVehicle) {
      alert('Välj först fordon på den rad där du fyllt i reg.nr – eller lämna reg.nr tomt.')
      return
    }

    if (hasOvertime) {
      const invalidRow = overtimeRowsForApi.find(
        (row) =>
          !TIME_RE.test(row.startTime) ||
          !TIME_RE.test(row.endTime) ||
          calculateOvertimeHours(row.startTime, row.endTime) <= 0
      )
      if (invalidRow) {
        alert('Övertid: ange giltiga start- och sluttider (HH:mm) på varje rad.')
        return
      }
      if (overtimeRowsForApi.length === 0) {
        alert('Övertid är ikryssat men inga rader är ifyllda. Avmarkera rutan eller lägg till rader.')
        return
      }
    }

    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/time-reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          date: selectedDate,
          entries: entries.map((e) => ({
            hours: e.hours,
            description: e.description,
            machineHours: e.machineHours,
            machineType: e.machineType,
            registrationNumber: e.registrationNumber,
          })),
          missingHoursReason: remainingHours > 0 ? missingHoursReason : null,
          buyerReference: buyerReference.trim() || null,
          overtimeEntries: overtimeRowsForApi.map((row) => ({
            startTime: row.startTime,
            endTime: row.endTime,
            note: row.note || null,
          })),
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte spara')
      }

      setSaveSuccessOpen(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = () => {
    switch (reportStatus) {
      case 'DRAFT':
        return 'Utkast'
      case 'SUBMITTED':
        return 'Inlämnad till chef'
      case 'APPROVED':
        return 'Godkänd'
      default:
        return reportStatus
    }
  }

  if (loading) {
    return (
      <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
        <p>Laddar tidrapport...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
        <div className="app-card max-w-xl">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            className="mt-4 px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
            onClick={() => router.push('/my-reports')}
          >
            Till mina rapporter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h1 className="app-title" style={{ color: '#2D5016' }}>
            {editable ? 'Redigera tidrapport' : 'Visa tidrapport'}
          </h1>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full shrink-0 ${
              reportStatus === 'APPROVED'
                ? 'bg-green-200 text-green-900'
                : reportStatus === 'SUBMITTED'
                  ? 'bg-yellow-200 text-yellow-900'
                  : 'bg-gray-200 text-gray-800'
            }`}
          >
            {statusLabel()}
          </span>
        </div>

        {!editable && (
          <p className="text-sm text-gray-600 mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
            Denna rapport är godkänd och är skrivskyddad. Kontakta din chef om något behöver rättas.
          </p>
        )}

        {editable && reportStatus === 'SUBMITTED' && (
          <p className="text-sm text-amber-800 mb-6 p-3 bg-amber-50 rounded-md border border-amber-100">
            Rapporten är redan inskickad. Du kan fortfarande uppdatera innehållet innan den har godkänts av chefen.
          </p>
        )}

        {editable ? (
          <form onSubmit={handleSave}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Kund</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Välj kund</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Datum</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="buyerReferenceEdit" className="block text-sm font-medium mb-2">
                Beställarens referens <span className="font-normal text-gray-500">(valfritt)</span>
              </label>
              <input
                id="buyerReferenceEdit"
                type="text"
                value={buyerReference}
                onChange={(e) => setBuyerReference(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                placeholder="T.ex. ordernummer eller projekt-ID från kund"
                maxLength={500}
                autoComplete="off"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Aktiviteter</label>
              {entries.map((entry, index) => (
                <div key={index} className="mb-4 p-4 border border-gray-200 rounded-md">
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Timmar</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={entry.hours}
                        onChange={(e) => updateEntry(index, 'hours', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Fordonstimmar (valfritt)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={entry.machineHours ?? ''}
                        onChange={(e) =>
                          updateEntry(index, 'machineHours', e.target.value ? parseFloat(e.target.value) : null)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Fordon <span className="font-normal text-gray-500">(valfritt)</span>
                      </label>
                      <select
                        value={entry.machineType}
                        onChange={(e) => updateEntry(index, 'machineType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Välj fordon</option>
                        {MACHINE_OPTIONS.map((machine) => (
                          <option key={machine} value={machine}>
                            {machine}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Reg.nr <span className="font-normal text-gray-500">(lämna tomt om inget fordon)</span>
                      </label>
                      <input
                        type="text"
                        value={entry.registrationNumber}
                        onChange={(e) => updateEntry(index, 'registrationNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Lämnas blankt om inget fordon väljs"
                        required={!!(entry.machineType && entry.machineType.trim())}
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Beskrivning</label>
                    <textarea
                      value={entry.description}
                      onChange={(e) => updateEntry(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                      required
                    />
                  </div>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEntry(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Ta bort rad
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEntry}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Lägg till aktivitet
              </button>
            </div>

            <div className="mb-6">
              <p className="text-lg font-semibold">Totalt arbetstid: {totalHours.toFixed(1)} timmar</p>
              <p className="text-sm text-gray-700">Totalt fordonstid: {totalMachineHours.toFixed(1)} timmar</p>
              {remainingHours > 0 && (
                <p className="text-sm text-orange-700 mt-1">
                  Resterande tid utan fordon: {remainingHours.toFixed(1)} timmar
                </p>
              )}
            </div>

            {remainingHours > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Förklara resterande tid (obligatorisk)</label>
                <textarea
                  value={missingHoursReason}
                  onChange={(e) => setMissingHoursReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required={remainingHours > 0}
                />
              </div>
            )}

            <div className="mb-6 border border-gray-200 rounded-md p-3 sm:p-4 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-800"
                  checked={hasOvertime}
                  onChange={(e) => handleOvertimeToggle(e.target.checked)}
                />
                <span className="text-sm font-semibold text-gray-800">
                  Jag har jobbat övertid den här dagen
                </span>
              </label>
              {hasOvertime && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-gray-600">
                    Lägg till tidsintervall för övertiden (HH:mm). Om sluttiden är mindre än
                    starttiden tolkas det som arbete in i nästa dygn.
                  </p>
                  {overtimeRows.map((row, index) => {
                    const validInterval =
                      TIME_RE.test(row.startTime) && TIME_RE.test(row.endTime)
                    const calculated = validInterval
                      ? calculateOvertimeHours(row.startTime, row.endTime)
                      : Number.NaN
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end p-3 border border-gray-200 rounded-md bg-white"
                      >
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Från</label>
                          <TimeOfDayInput
                            value={row.startTime}
                            onChange={(v) => updateOvertimeRow(index, 'startTime', v)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            ariaLabel="Övertid från (HH:mm)"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Till</label>
                          <TimeOfDayInput
                            value={row.endTime}
                            onChange={(v) => updateOvertimeRow(index, 'endTime', v)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            ariaLabel="Övertid till (HH:mm)"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Anteckning <span className="font-normal text-gray-500">(valfritt)</span>
                          </label>
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateOvertimeRow(index, 'note', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            maxLength={200}
                          />
                        </div>
                        <div className="flex md:flex-col md:items-end justify-between gap-1">
                          <span className="text-sm font-semibold text-green-900 tabular-nums">
                            {validInterval && !Number.isNaN(calculated)
                              ? `${calculated.toFixed(1)} h`
                              : '— h'}
                          </span>
                          {overtimeRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOvertimeRow(index)}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Ta bort
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={addOvertimeRow}
                      className="px-3 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300"
                    >
                      + Lägg till övertidsrad
                    </button>
                    <span className="text-sm font-semibold text-green-900">
                      Totalt övertid: {totalOvertime.toFixed(1)} timmar
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 text-white rounded-md hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#2D5016' }}
              >
                {saving ? 'Sparar...' : 'Spara ändringar'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/my-reports')}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Tillbaka
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500">Kund</p>
              <p className="font-medium">
                {customers.find((c) => c.id === selectedCustomer)?.name || customerDisplayName || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Datum</p>
              <p className="font-medium">{selectedDate ? new Date(selectedDate).toLocaleDateString('sv-SE') : '—'}</p>
            </div>
            {buyerReference.trim() && (
              <div>
                <p className="text-sm text-gray-500">Beställarens referens</p>
                <p className="font-medium">{buyerReference}</p>
              </div>
            )}
            {missingHoursReason?.trim() && (
              <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                <p className="text-sm text-gray-500">Motivering vid skillnad arbete–fordon</p>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{missingHoursReason}</p>
              </div>
            )}
            {entries.map((entry, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-4">
                <p className="text-sm text-gray-500">
                  Aktivitet {idx + 1}: {entry.hours} h arbetad
                  {entry.machineHours ? ` · ${entry.machineHours} h fordon` : ''}
                </p>
                {(entry.machineType || entry.registrationNumber) && (
                  <p className="text-sm text-gray-600 mt-1">
                    {entry.machineType}
                    {entry.registrationNumber ? ` (${entry.registrationNumber})` : ''}
                  </p>
                )}
                <p className="text-gray-900 mt-1">{entry.description}</p>
              </div>
            ))}
            {overtimeRows.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/40 rounded-md p-4">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  Övertid · totalt {totalOvertime.toFixed(1)} h
                </p>
                <ul className="space-y-1 text-sm text-gray-800">
                  {overtimeRows.map((row, idx) => {
                    const calc =
                      TIME_RE.test(row.startTime) && TIME_RE.test(row.endTime)
                        ? calculateOvertimeHours(row.startTime, row.endTime)
                        : Number.NaN
                    return (
                      <li key={idx}>
                        {row.startTime}–{row.endTime} · {Number.isNaN(calc) ? '—' : calc.toFixed(1)} h
                        {row.note ? ` · ${row.note}` : ''}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push('/my-reports')}
              className="px-6 py-3 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Tillbaka till mina rapporter
            </button>
          </div>
        )}
      </div>

      <SuccessDialog
        open={saveSuccessOpen}
        title="Ändringar sparade"
        message="Din tidrapport har sparats. Klicka OK för att gå till mina rapporter."
        onClose={() => {
          setSaveSuccessOpen(false)
          router.push('/my-reports')
        }}
      />
    </div>
  )
}
