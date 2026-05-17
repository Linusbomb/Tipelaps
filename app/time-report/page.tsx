'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SuccessDialog from '@/app/components/SuccessDialog'
import ConfirmDialog from '@/app/components/ConfirmDialog'
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

function formatMonthYearSv(monthKey: string) {
  const raw = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('sv-SE', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function TimeReportPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submittingMonth, setSubmittingMonth] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [monthReports, setMonthReports] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([
    {
      hours: 0,
      description: '',
      machineHours: null as number | null,
      machineType: '',
      registrationNumber: '',
    },
  ])
  const [missingHoursReason, setMissingHoursReason] = useState('')
  const [buyerReference, setBuyerReference] = useState('')
  const [hasOvertime, setHasOvertime] = useState(false)
  const [overtimeRows, setOvertimeRows] = useState<OvertimeRow[]>([])
  const [pendingProjectPrefill, setPendingProjectPrefill] = useState<{
    customerId?: string
    customerName?: string
    address?: string
  } | null>(null)
  const [successFeedback, setSuccessFeedback] = useState<{ title: string; message: string } | null>(null)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  const getSubmitStatusLabel = (status: string) => {
    if (status === 'SUBMITTED' || status === 'APPROVED') {
      return 'Inskickat'
    }
    return 'Ej inskickat'
  }

  const groupedMonthReports = monthReports.reduce((acc: any[], report: any) => {
    const key = `${report.customer?.id || 'unknown'}`
    const existingGroup = acc.find((group) => group.key === key)

    if (existingGroup) {
      existingGroup.reports.push(report)
      existingGroup.totalHours += report.totalHours || 0
      if (report.status === 'SUBMITTED' || report.status === 'APPROVED') {
        existingGroup.submittedCount += 1
      }
    } else {
      acc.push({
        key,
        customerName: report.customer?.name || 'Okänd kund',
        reports: [report],
        totalHours: report.totalHours || 0,
        submittedCount: report.status === 'SUBMITTED' || report.status === 'APPROVED' ? 1 : 0,
      })
    }

    return acc
  }, [])

  const fetchMonthReports = useCallback(async (monthKey: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/time-reports?month=${encodeURIComponent(monthKey)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMonthReports(data)
      }
    } catch (error) {
      console.error('Fel vid hämtning av månadens tidrapporter:', error)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()

    const storedPrefill = localStorage.getItem('prefillTimeReportFromProject')
    if (storedPrefill) {
      try {
        const parsed = JSON.parse(storedPrefill)
        setPendingProjectPrefill(parsed)
      } catch (error) {
        console.error('Kunde inte läsa projektprefill:', error)
      } finally {
        localStorage.removeItem('prefillTimeReportFromProject')
      }
    }
  }, [])

  useEffect(() => {
    fetchMonthReports(selectedDate.slice(0, 7))
  }, [selectedDate, fetchMonthReports])

  useEffect(() => {
    if (!pendingProjectPrefill || customers.length === 0) return

    const matchingCustomer = customers.find((customer) => customer.id === pendingProjectPrefill.customerId)
    if (matchingCustomer) {
      setSelectedCustomer(matchingCustomer.id)
    } else if (pendingProjectPrefill.customerName) {
      const byName = customers.find(
        (customer) => customer.name.toLowerCase() === pendingProjectPrefill.customerName?.toLowerCase()
      )
      if (byName) {
        setSelectedCustomer(byName.id)
      }
    }

    if (pendingProjectPrefill.address) {
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        const existingDescription = (next[0].description || '').trim()
        if (!existingDescription) {
          next[0] = {
            ...next[0],
            description: `Projektadress: ${pendingProjectPrefill.address}`,
          }
        }
        return next
      })
    }

    setPendingProjectPrefill(null)
  }, [pendingProjectPrefill, customers])

  const currentMonth = selectedDate.slice(0, 7)
  const draftCountThisMonth = monthReports.filter((r) => r.status === 'DRAFT').length
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)
  const totalMachineHours = entries.reduce((sum, e) => sum + (e.machineHours && e.machineHours > 0 ? e.machineHours : 0), 0)
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

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/customers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Fel vid hämtning av kunder:', error)
    }
  }

  const createCustomer = async () => {
    const name = newCustomerName.trim()
    if (!name) {
      alert('Fyll i kundnamn')
      return
    }

    try {
      setCreatingCustomer(true)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa kund')
      }

      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')))
      setSelectedCustomer(data.id)
      setNewCustomerName('')
    } catch (error: any) {
      alert(error.message || 'Ett fel uppstod vid skapande av kund')
    } finally {
      setCreatingCustomer(false)
    }
  }

  const addEntry = () => {
    setEntries([
      ...entries,
      { hours: 0, description: '', machineHours: null, machineType: '', registrationNumber: '' },
    ])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const updateEntry = (index: number, field: string, value: any) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], [field]: value }
    setEntries(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      (entry: any) =>
        !!(entry.machineType && String(entry.machineType).trim()) &&
        !(entry.registrationNumber && String(entry.registrationNumber).trim())
    )
    if (missingRegForChosenVehicle) {
      alert('Om du väljer fordon måste reg.nr anges på den aktiviteten.')
      return
    }
    const regWithoutVehicle = entries.find(
      (entry: any) =>
        !(entry.machineType && String(entry.machineType).trim()) &&
        !!(entry.registrationNumber && String(entry.registrationNumber).trim())
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

    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      const response = await fetch('/api/time-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: selectedCustomer,
          date: selectedDate,
          totalHours,
          missingHoursReason: remainingHours > 0 ? missingHoursReason : null,
          buyerReference: buyerReference.trim() || null,
          entries: entries.map(e => ({
            hours: e.hours,
            description: e.description,
            machineHours: e.machineHours,
            machineType: e.machineType,
            registrationNumber: e.registrationNumber,
          })),
          overtimeEntries: overtimeRowsForApi.map((row) => ({
            startTime: row.startTime,
            endTime: row.endTime,
            note: row.note || null,
          })),
        }),
      })

      if (response.ok) {
        const savedMonthKey = selectedDate.slice(0, 7)
        setEntries([
          {
            hours: 0,
            description: '',
            machineHours: null,
            machineType: '',
            registrationNumber: '',
          },
        ])
        setMissingHoursReason('')
        setBuyerReference('')
        setHasOvertime(false)
        setOvertimeRows([])
        await fetchMonthReports(savedMonthKey)
        setSelectedDate(new Date().toISOString().split('T')[0])
        setSuccessFeedback({
          title: 'Tidrapport sparad',
          message:
            'Din tidrapport har sparats som utkast. Du kan redigera den under Mina rapporter tills du skickar in månadens tidrapporter.',
        })
      } else {
        const data = await response.json()
        alert(data.error || 'Kunde inte skapa tidrapport')
      }
    } catch (error) {
      console.error('Fel:', error)
      alert('Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const submitCurrentMonthReports = async () => {
    try {
      setSubmittingMonth(true)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const monthKey = selectedDate.slice(0, 7)
      const response = await fetch('/api/time-reports/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ month: monthKey }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka in tidrapporter')
      }

      setSuccessFeedback({
        title: 'Tidrapporter inskickade',
        message:
          data.message ||
          'Månadens tidrapporter har skickats till administratören för granskning.',
      })
      fetchMonthReports(monthKey)
    } catch (error: any) {
      alert(error.message || 'Ett fel uppstod')
    } finally {
      setSubmittingMonth(false)
    }
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-6" style={{ color: '#2D5016' }}>
          Skapa tidrapport
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Kund:</label>
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
            <div className="mt-3 flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Skapa ny kund"
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
              <button
                type="button"
                onClick={createCustomer}
                disabled={creatingCustomer}
                className="w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {creatingCustomer ? 'Skapar...' : 'Skapa ny kund'}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Datum:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="buyerReference" className="block text-sm font-medium mb-2">
              Beställarens referens <span className="font-normal text-gray-500">(valfritt)</span>
            </label>
            <input
              id="buyerReference"
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
            <label className="block text-sm font-medium mb-2">Aktiviteter:</label>
            {entries.map((entry, index) => (
              <div key={index} className="mb-4 p-3 sm:p-4 border border-gray-200 rounded-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Timmar:</label>
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
                    <label className="block text-sm font-medium mb-1">Fordonstimmar (valfritt):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={entry.machineHours || ''}
                      onChange={(e) => updateEntry(index, 'machineHours', e.target.value ? parseFloat(e.target.value) : null)}
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
                      value={(entry as any).machineType || ''}
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
                      Reg.nr{' '}
                      <span className="font-normal text-gray-500">(lämna tomt om inget fordon)</span>
                    </label>
                    <input
                      type="text"
                      value={(entry as any).registrationNumber || ''}
                      onChange={(e) => updateEntry(index, 'registrationNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Lämnas blankt om inget fordon väljs"
                      required={
                        !!(entry.machineType && String(entry.machineType).trim())
                      }
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium mb-1">Beskrivning:</label>
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
                    Ta bort
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addEntry}
              className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Lägg till aktivitet
            </button>
          </div>

          <div className="mb-6">
            <p className="text-lg font-semibold">
              Totalt arbetstid: {totalHours.toFixed(1)} timmar
            </p>
            <p className="text-sm text-gray-700">
              Totalt fordonstid: {totalMachineHours.toFixed(1)} timmar
            </p>
            {remainingHours > 0 && (
              <p className="text-sm text-orange-700 mt-1">
                Resterande tid utan fordon: {remainingHours.toFixed(1)} timmar
              </p>
            )}
          </div>

          {remainingHours > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Förklara resterande tid (obligatorisk)
              </label>
              <textarea
                value={missingHoursReason}
                onChange={(e) => setMissingHoursReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder='Exempel: "städat garaget", "service av fordon", "förberett material"...'
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
                  Lägg till tidsintervall för övertiden. Använd 24-timmarsformat (HH:mm). Om sluttiden
                  är mindre än starttiden tolkas det som att du arbetat in i nästa dygn.
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
                          placeholder="T.ex. akutarbete, beredskap…"
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

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Sparar...' : 'Spara tidrapport'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Avbryt
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#2D5016' }}>
              Tidrapporter för månaden {formatMonthYearSv(currentMonth)}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Utkast kan du öppna och ändra nedan fram tills du klickar &quot;Skicka in tidrapporter&quot; för månaden.
            </p>
            {monthReports.length === 0 ? (
              <p className="text-gray-500 mb-4">Inga tidrapporter skapade för denna månad ännu.</p>
            ) : (
              <div className="space-y-4 mb-4">
                {groupedMonthReports.map((group: any) => (
                  <div key={group.key} className="border border-gray-200 rounded-md">
                    <div className="px-4 py-3 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <p className="text-sm font-semibold">{group.customerName}</p>
                      <p className="text-xs text-gray-600">
                        {group.reports.length} rapport{group.reports.length > 1 ? 'er' : ''} | Totalt {group.totalHours.toFixed(1)} h |{' '}
                        {group.submittedCount === group.reports.length ? 'Inskickat' : 'Ej inskickat'}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timmar</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Åtgärd
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {group.reports.map((report: any) => (
                            <tr key={report.id}>
                              <td className="px-4 py-2 text-sm">{new Date(report.date).toLocaleDateString('sv-SE')}</td>
                              <td className="px-4 py-2 text-sm">{report.totalHours?.toFixed(1)} h</td>
                              <td className="px-4 py-2 text-sm">{getSubmitStatusLabel(report.status)}</td>
                              <td className="px-4 py-2 text-sm">
                                {report.status === 'DRAFT' ? (
                                  <Link
                                    href={`/time-report/${report.id}`}
                                    className="font-medium text-green-800 underline underline-offset-2 hover:text-green-950"
                                  >
                                    Redigera
                                  </Link>
                                ) : report.status === 'SUBMITTED' ? (
                                  <Link
                                    href={`/time-report/${report.id}`}
                                    className="text-amber-800 underline underline-offset-2 hover:text-amber-950 text-sm"
                                  >
                                    Ändra innan godkännande
                                  </Link>
                                ) : report.status === 'APPROVED' ? (
                                  <Link
                                    href={`/time-report/${report.id}`}
                                    className="text-gray-600 underline underline-offset-2 hover:text-gray-900 text-sm"
                                  >
                                    Visa
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/time-report/${report.id}`}
                                    className="text-green-700 underline text-sm"
                                  >
                                    Öppna
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={submittingMonth || draftCountThisMonth === 0}
              onClick={() => setSubmitConfirmOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {submittingMonth ? 'Skickar in...' : 'Skicka in tidrapporter'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={submitConfirmOpen}
        title="Skicka in tidrapporter?"
        message={`Du håller på att skicka in alla utkast för ${formatMonthYearSv(currentMonth)} till administratören (${draftCountThisMonth} ${draftCountThisMonth === 1 ? 'rapport' : 'rapporter'}). Är du säker på att du vill fortsätta?`}
        confirmLabel="Ja, skicka in"
        onCancel={() => setSubmitConfirmOpen(false)}
        onConfirm={() => {
          setSubmitConfirmOpen(false)
          void submitCurrentMonthReports()
        }}
      />

      <SuccessDialog
        open={successFeedback !== null}
        title={successFeedback?.title ?? ''}
        message={successFeedback?.message ?? ''}
        onClose={() => setSuccessFeedback(null)}
      />
    </div>
  )
}