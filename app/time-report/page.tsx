'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SuccessDialog from '@/app/components/SuccessDialog'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import MonthCustomerReportFolders, {
  groupReportsByCustomer,
} from '@/app/components/MonthCustomerReportFolders'
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
  const [pendingProjectPrefill, setPendingProjectPrefill] = useState<{
    customerId?: string
    customerName?: string
    address?: string
  } | null>(null)
  const [successFeedback, setSuccessFeedback] = useState<{ title: string; message: string } | null>(null)
  const [submitConfirm, setSubmitConfirm] = useState<
    | { scope: 'all'; count: number }
    | { scope: 'customer'; customerId: string; customerName: string; count: number }
    | null
  >(null)
  const [submittingCustomerId, setSubmittingCustomerId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const [companyEmployees, setCompanyEmployees] = useState<{ id: string; name: string; email: string }[]>([])
  const [reportForUserId, setReportForUserId] = useState('')

  const isAdmin =
    currentUser?.role === 'ENTREPRENEUR' || currentUser?.role === 'PAYROLL_COORDINATOR'

  const reportForUser = useCallback(() => {
    if (!currentUser) return null
    if (!isAdmin || reportForUserId === currentUser.id) {
      return { id: currentUser.id, name: currentUser.name }
    }
    const emp = companyEmployees.find((e) => e.id === reportForUserId)
    return emp ? { id: emp.id, name: emp.name } : { id: currentUser.id, name: currentUser.name }
  }, [currentUser, isAdmin, reportForUserId, companyEmployees])

  const groupedMonthReports = groupReportsByCustomer(monthReports)

  const fetchMonthReports = useCallback(async (monthKey: string, forUserId?: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const params = new URLSearchParams({ month: monthKey })
      if (forUserId) params.set('forUserId', forUserId)

      const response = await fetch(`/api/time-reports?${params.toString()}`, {
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
    const raw = localStorage.getItem('user')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { id: string; name: string; role: string }
      setCurrentUser(parsed)
      setReportForUserId(parsed.id)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const token = localStorage.getItem('token')
    if (!token) return

    fetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCompanyEmployees(Array.isArray(data) ? data : []))
      .catch(() => setCompanyEmployees([]))
  }, [isAdmin])

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
    if (!reportForUserId) return
    fetchMonthReports(selectedDate.slice(0, 7), reportForUserId)
  }, [selectedDate, reportForUserId, fetchMonthReports])

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
  const overtimeHours = computeOvertimeHours(totalHours)

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
          ...(isAdmin && reportForUserId ? { forUserId: reportForUserId } : {}),
          entries: entries.map(e => ({
            hours: e.hours,
            description: e.description,
            machineHours: e.machineHours,
            machineType: e.machineType,
            registrationNumber: e.registrationNumber,
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
        await fetchMonthReports(savedMonthKey, reportForUserId)
        setSelectedDate(new Date().toISOString().split('T')[0])
        const subject = reportForUser()
        const forLabel =
          isAdmin && subject && subject.id !== currentUser?.id
            ? ` för ${subject.name}`
            : ''
        setSuccessFeedback({
          title: 'Tidrapport sparad',
          message: `Tidrapporten${forLabel} har sparats som utkast. ${
            isAdmin && subject && subject.id !== currentUser?.id
              ? 'Den syns under personalens rapporter och i admin-vyn.'
              : 'Du kan redigera den under Mina rapporter tills du skickar in månadens tidrapporter.'
          }`,
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

  const submitMonthReports = async (customerId?: string) => {
    try {
      setSubmittingMonth(true)
      if (customerId) setSubmittingCustomerId(customerId)

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month: monthKey,
          ...(customerId ? { customerId } : {}),
          ...(isAdmin && reportForUserId ? { forUserId: reportForUserId } : {}),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka in tidrapporter')
      }

      setSuccessFeedback({
        title: 'Tidrapporter inskickade',
        message:
          data.message ||
          'Tidrapporterna har skickats till administratören för granskning.',
      })
      fetchMonthReports(monthKey, reportForUserId)
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Ett fel uppstod')
    } finally {
      setSubmittingMonth(false)
      setSubmittingCustomerId(null)
    }
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-6" style={{ color: '#2D5016' }}>
          Skapa tidrapport
        </h1>

        <form onSubmit={handleSubmit}>
          {isAdmin && currentUser && (
            <div className="mb-6 p-4 rounded-md border border-green-200 bg-green-50">
              <label htmlFor="reportForUser" className="block text-sm font-medium mb-2 text-gray-900">
                Tidrapport för
              </label>
              <select
                id="reportForUser"
                value={reportForUserId}
                onChange={(e) => setReportForUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value={currentUser.id}>Mig själv ({currentUser.name})</option>
                {companyEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-600">
                Välj om rapporten gäller dig eller en anställd. Utkast och inlämning gäller den valda personen.
              </p>
            </div>
          )}

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
                    <HoursInput
                      value={entry.hours}
                      onChange={(hours) => updateEntry(index, 'hours', hours ?? 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fordonstimmar (valfritt):</label>
                    <HoursInput
                      optional
                      value={entry.machineHours}
                      onChange={(machineHours) => updateEntry(index, 'machineHours', machineHours)}
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
            <OvertimeSummary overtimeHours={overtimeHours} />
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
              {isAdmin && reportForUser() && reportForUser()!.id !== currentUser?.id
                ? ` · ${reportForUser()!.name}`
                : ''}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Tidrapporterna är sorterade per kund. Skicka en kundmapp i taget, eller alla utkast på en gång.
              {isAdmin && reportForUser() && reportForUser()!.id !== currentUser?.id
                ? ' Inlämning gäller den valda personens utkast.'
                : ''}
            </p>
            <MonthCustomerReportFolders
              groups={groupedMonthReports}
              totalDraftCount={draftCountThisMonth}
              submitting={submittingMonth}
              submittingCustomerId={submittingCustomerId}
              onSubmitAll={() =>
                setSubmitConfirm({ scope: 'all', count: draftCountThisMonth })
              }
              onSubmitCustomer={(customerId, customerName) => {
                const count =
                  groupedMonthReports.find((g) => g.customerId === customerId)?.draftCount ?? 0
                setSubmitConfirm({ scope: 'customer', customerId, customerName, count })
              }}
            />
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={submitConfirm !== null}
        title={
          submitConfirm?.scope === 'customer'
            ? `Skicka ${submitConfirm.customerName}?`
            : 'Skicka alla tidrapporter?'
        }
        message={
          submitConfirm
            ? submitConfirm.scope === 'customer'
              ? `Du skickar in ${submitConfirm.count} utkast för ${submitConfirm.customerName} (${formatMonthYearSv(currentMonth)}) till administratören. Fortsätta?`
              : `Du skickar in alla ${submitConfirm.count} utkast för ${formatMonthYearSv(currentMonth)} till administratören. Fortsätta?`
            : ''
        }
        confirmLabel="Ja, skicka in"
        onCancel={() => setSubmitConfirm(null)}
        onConfirm={() => {
          if (!submitConfirm) return
          const pending = submitConfirm
          setSubmitConfirm(null)
          if (pending.scope === 'customer') {
            void submitMonthReports(pending.customerId)
          } else {
            void submitMonthReports()
          }
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