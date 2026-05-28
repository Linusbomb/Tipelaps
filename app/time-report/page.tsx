'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SuccessDialog from '@/app/components/SuccessDialog'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import MonthAbsenceReportSection from '@/app/components/MonthAbsenceReportSection'
import MonthCustomerReportFolders, {
  groupReportsByCustomer,
} from '@/app/components/MonthCustomerReportFolders'
import ClockTimeInput from '@/app/components/ClockTimeInput'
import HoursInput from '@/app/components/HoursInput'
import OvertimeSummary from '@/app/components/OvertimeSummary'
import { ABSENCE_TYPES, absenceTypeLabel } from '@/lib/absence'
import { computeOvertimeHours } from '@/lib/overtime'
import MonthSubmissionReminder from '@/app/components/MonthSubmissionReminder'
import {
  buildMonthOptions,
  dateInputBounds,
  formatMonthYearSv,
  getPreviousMonthKey,
  isPastMonth,
  resolveMonthReminder,
  toMonthKey,
} from '@/lib/monthReporting'
import {
  addDaysToIsoDate,
  customerIdForSelectedProject,
  extractFormStateFromReport,
  findReportForDate,
  mapApiProjectsToOptions,
  type MyProjectOption,
  type ProjectPrefillPayload,
} from '@/lib/timeReportForm'

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

export default function TimeReportPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [submittingMonth, setSubmittingMonth] = useState(false)
  const [activeTab, setActiveTab] = useState<'create' | 'submit'>('create')
  const [customers, setCustomers] = useState<any[]>([])
  const [monthReports, setMonthReports] = useState<any[]>([])
  const [monthAbsences, setMonthAbsences] = useState<any[]>([])
  const [isAbsenceMode, setIsAbsenceMode] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [manageMonth, setManageMonth] = useState(() => toMonthKey(new Date()))
  const [previousMonthDraftCount, setPreviousMonthDraftCount] = useState(0)
  const monthOptions = buildMonthOptions(36)
  const { min: dateMin, max: dateMax } = dateInputBounds(36)
  const [absenceType, setAbsenceType] = useState(ABSENCE_TYPES[0].value)
  const [absenceIsFullDay, setAbsenceIsFullDay] = useState(true)
  const [absenceHours, setAbsenceHours] = useState<number | ''>('')
  const [absenceNote, setAbsenceNote] = useState('')
  const [entries, setEntries] = useState([
    {
      hours: 0,
      description: '',
      machineHours: null as number | null,
      startTime: '',
      endTime: '',
      machineType: '',
      registrationNumber: '',
    },
  ])
  const [missingHoursReason, setMissingHoursReason] = useState('')
  const [buyerReference, setBuyerReference] = useState('')
  const [pendingProjectPrefill, setPendingProjectPrefill] = useState<ProjectPrefillPayload | null>(null)
  const [copyingPreviousDay, setCopyingPreviousDay] = useState(false)
  const [successFeedback, setSuccessFeedback] = useState<{ title: string; message: string } | null>(null)
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set())
  const [submitConfirm, setSubmitConfirm] = useState<
    | { scope: 'all'; count: number }
    | { scope: 'selected'; count: number; reportIds: string[] }
    | null
  >(null)
  const [submittingCustomerId, setSubmittingCustomerId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const [companyEmployees, setCompanyEmployees] = useState<{ id: string; name: string; email: string }[]>([])
  const [reportForUserId, setReportForUserId] = useState('')
  const [myProjects, setMyProjects] = useState<MyProjectOption[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [reportToDelete, setReportToDelete] = useState<{
    id: string
    date: string
    customerName: string
  } | null>(null)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)

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

  const draftMonthReports = useMemo(
    () => monthReports.filter((r) => r.status === 'DRAFT'),
    [monthReports]
  )
  const draftMonthAbsences = useMemo(
    () => monthAbsences.filter((r) => r.status === 'DRAFT'),
    [monthAbsences]
  )
  const groupedMonthReports = useMemo(
    () => groupReportsByCustomer(draftMonthReports),
    [draftMonthReports]
  )

  const draftReportIdsThisMonth = useMemo(
    () => draftMonthReports.map((r) => r.id),
    [draftMonthReports]
  )

  useEffect(() => {
    setSelectedReportIds(new Set(draftReportIdsThisMonth))
  }, [draftReportIdsThisMonth.join(',')])

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

  const fetchMonthAbsences = useCallback(async (monthKey: string, forUserId?: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const params = new URLSearchParams({ month: monthKey })
      if (forUserId) params.set('forUserId', forUserId)

      const response = await fetch(`/api/absence-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setMonthAbsences(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Fel vid hämtning av frånvaro:', error)
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
    if (searchParams.get('tab') === 'submit') {
      setActiveTab('submit')
    }
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam)
      setActiveTab('create')
    }
    const forUserParam = searchParams.get('forUserId')
    if (
      forUserParam &&
      currentUser &&
      (currentUser.role === 'ENTREPRENEUR' || currentUser.role === 'PAYROLL_COORDINATOR')
    ) {
      setReportForUserId(forUserParam)
      setActiveTab('create')
    }
  }, [searchParams, currentUser])

  useEffect(() => {
    fetchCustomers()

    const storedPrefill = localStorage.getItem('prefillTimeReportFromProject')
    if (storedPrefill) {
      try {
        const parsed = JSON.parse(storedPrefill) as ProjectPrefillPayload
        setPendingProjectPrefill(parsed)
        setActiveTab('create')
      } catch (error) {
        console.error('Kunde inte läsa projektprefill:', error)
      } finally {
        localStorage.removeItem('prefillTimeReportFromProject')
      }
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/projects/my-projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) return
        setMyProjects(mapApiProjectsToOptions(data))
      })
      .catch(() => setMyProjects([]))
  }, [])

  useEffect(() => {
    if (!reportForUserId) return
    fetchMonthReports(manageMonth, reportForUserId)
    fetchMonthAbsences(manageMonth, reportForUserId)
  }, [manageMonth, reportForUserId, fetchMonthReports, fetchMonthAbsences])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !reportForUserId) return
    const prevMonth = getPreviousMonthKey()
    const params = new URLSearchParams({ month: prevMonth })
    if (isAdmin && reportForUserId) params.set('forUserId', reportForUserId)
    fetch(`/api/time-reports?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setPreviousMonthDraftCount(list.filter((r: { status: string }) => r.status === 'DRAFT').length)
      })
      .catch(() => setPreviousMonthDraftCount(0))
  }, [manageMonth, reportForUserId, isAdmin])

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

    if (pendingProjectPrefill.projectId) {
      setSelectedProjectId(pendingProjectPrefill.projectId)
    }

    const descriptionLines: string[] = []
    if (pendingProjectPrefill.description?.trim()) {
      descriptionLines.push(pendingProjectPrefill.description.trim())
    } else {
      if (pendingProjectPrefill.projectName) {
        descriptionLines.push(`Projekt: ${pendingProjectPrefill.projectName}`)
      }
      if (pendingProjectPrefill.address?.trim()) {
        descriptionLines.push(`Adress: ${pendingProjectPrefill.address.trim()}`)
      }
    }
    if (
      pendingProjectPrefill.assignedEquipment?.trim() &&
      !descriptionLines.some((line) => line.includes('Tilldelat fordon:'))
    ) {
      descriptionLines.push(`Tilldelat fordon: ${pendingProjectPrefill.assignedEquipment.trim()}`)
    }

    const prefillDescription = descriptionLines.join('\n')
    if (prefillDescription) {
      setEntries((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        next[0] = {
          ...next[0],
          description: prefillDescription,
        }
        return next
      })
    }

    setIsAbsenceMode(false)
    setActiveTab('create')
    setPendingProjectPrefill(null)
  }, [pendingProjectPrefill, customers])

  const currentMonth = manageMonth
  const draftCountThisMonth = draftMonthReports.length
  const draftAbsenceCountThisMonth = draftMonthAbsences.length
  const totalDraftCountThisMonth = draftCountThisMonth + draftAbsenceCountThisMonth
  const monthReminder = resolveMonthReminder({
    viewMonth: manageMonth,
    draftCountCurrentMonth: draftCountThisMonth,
    draftCountPreviousMonth: previousMonthDraftCount,
  })
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)
  const totalMachineHours = entries.reduce((sum, e) => sum + (e.machineHours && e.machineHours > 0 ? e.machineHours : 0), 0)
  const remainingHours = totalHours - totalMachineHours
  const overtimeHours = computeOvertimeHours(totalHours, entries)

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/customers?activeOnly=true', {
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

      const response = await fetch('/api/customers?activeOnly=true', {
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
      { hours: 0, description: '', machineHours: null, startTime: '', endTime: '', machineType: '', registrationNumber: '' },
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

  const copyFromPreviousDay = async () => {
    const previousDate = addDaysToIsoDate(selectedDate, -1)
    const previousMonth = previousDate.slice(0, 7)

    setCopyingPreviousDay(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams({ month: previousMonth })
      if (isAdmin && reportForUserId) params.set('forUserId', reportForUserId)

      const response = await fetch(`/api/time-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        throw new Error('Kunde inte hämta tidrapporter')
      }

      const reports = await response.json()
      const list = Array.isArray(reports) ? reports : []
      const previousReport = findReportForDate(list, previousDate)
      if (!previousReport) {
        alert(`Ingen tidrapport hittades för ${previousDate}.`)
        return
      }

      const copied = extractFormStateFromReport(previousReport)
      if (copied.customerId) setSelectedCustomer(copied.customerId)
      setSelectedProjectId(copied.projectId)
      setBuyerReference(copied.buyerReference)
      setMissingHoursReason(copied.missingHoursReason)
      setEntries(copied.entries)
      setIsAbsenceMode(false)
      setActiveTab('create')
    } catch (error: any) {
      alert(error.message || 'Kunde inte kopiera från föregående dag')
    } finally {
      setCopyingPreviousDay(false)
    }
  }

  const handleAbsenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!absenceIsFullDay && (!absenceHours || Number(absenceHours) <= 0)) {
      alert('Ange antal timmar för del av dag')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/absence-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          type: absenceType,
          isFullDay: absenceIsFullDay,
          hours: absenceIsFullDay ? null : absenceHours,
          note: absenceNote.trim() || null,
          ...(isAdmin && reportForUserId ? { forUserId: reportForUserId } : {}),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa frånvaro')
      }

      const savedMonthKey = selectedDate.slice(0, 7)
      setAbsenceType(ABSENCE_TYPES[0].value)
      setAbsenceIsFullDay(true)
      setAbsenceHours('')
      setAbsenceNote('')
      await fetchMonthAbsences(savedMonthKey, reportForUserId)

      const subject = reportForUser()
      const forLabel =
        isAdmin && subject && subject.id !== currentUser?.id ? ` för ${subject.name}` : ''
      setSuccessFeedback({
        title: 'Frånvaro sparad',
        message: `Frånvaron${forLabel} har sparats som utkast. Skicka in månadens utkast när allt är klart.`,
      })
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
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
          projectId: selectedProjectId || null,
          date: selectedDate,
          totalHours,
          missingHoursReason: remainingHours > 0 ? missingHoursReason : null,
          buyerReference: buyerReference.trim() || null,
          ...(isAdmin && reportForUserId ? { forUserId: reportForUserId } : {}),
          entries: entries.map(e => ({
            hours: e.hours,
            description: e.description,
            machineHours: e.machineHours,
            startTime: e.startTime,
            endTime: e.endTime,
            machineType: e.machineType,
            registrationNumber: e.registrationNumber,
          })),
        }),
      })

      if (response.ok) {
        const saved = await response.json()
        if (pendingImages.length > 0 && saved?.id) {
          const token = localStorage.getItem('token')
          if (token) {
            for (const file of pendingImages) {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('timeReportId', saved.id)
              if (selectedProjectId) formData.append('projectId', selectedProjectId)
              await fetch('/api/project-attachments', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              })
            }
          }
        }
        const savedMonthKey = selectedDate.slice(0, 7)
        setEntries([
          {
            hours: 0,
            description: '',
            machineHours: null,
            startTime: '',
            endTime: '',
            machineType: '',
            registrationNumber: '',
          },
        ])
        setMissingHoursReason('')
        setBuyerReference('')
        setPendingImages([])
        setSelectedProjectId('')
        await fetchMonthReports(savedMonthKey, reportForUserId)
        setManageMonth(savedMonthKey)
        if (savedMonthKey === toMonthKey(new Date())) {
          setSelectedDate(new Date().toISOString().split('T')[0])
        }
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

  const toggleReportSelection = (reportId: string) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }

  const toggleCustomerDrafts = (customerId: string, draftIds: string[], checked: boolean) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev)
      for (const id of draftIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const deleteReport = async (reportId: string) => {
    try {
      setDeletingReportId(reportId)
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/time-reports/${reportId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ta bort tidrapporten')
      }

      setReportToDelete(null)
      setSelectedReportIds((prev) => {
        const next = new Set(prev)
        next.delete(reportId)
        return next
      })
      await fetchMonthReports(manageMonth, reportForUserId)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kunde inte ta bort tidrapporten')
    } finally {
      setDeletingReportId(null)
    }
  }

  const submitMonthReports = async (opts?: { reportIds?: string[]; allDrafts?: boolean }) => {
    try {
      setSubmittingMonth(true)

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const monthKey = manageMonth
      const body: Record<string, unknown> = {
        month: monthKey,
        ...(isAdmin && reportForUserId ? { forUserId: reportForUserId } : {}),
      }

      if (opts?.reportIds && opts.reportIds.length > 0) {
        body.reportIds = opts.reportIds
      }

      const response = await fetch('/api/time-reports/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka in tidrapporter')
      }

      setSuccessFeedback({
        title: 'Tidrapporter inskickade',
        message:
          data.message ||
          'Tidrapporterna har skickats till admin. Admin skapar fakturor och skickar till kund.',
      })
      fetchMonthReports(monthKey, reportForUserId)
      fetchMonthAbsences(monthKey, reportForUserId)
      setSelectedReportIds(new Set())
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
          Tidrapportering
        </h1>

        <div className="mb-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
              activeTab === 'create'
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Skapa tidrapport
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
              activeTab === 'submit'
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tidrapporter &amp; inlämning
          </button>
        </div>

        <form onSubmit={isAbsenceMode ? handleAbsenceSubmit : handleSubmit}>
          {activeTab === 'create' && isAdmin && currentUser && (
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

          {activeTab === 'create' && (
          <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-start gap-3 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                checked={isAbsenceMode}
                onChange={(e) => setIsAbsenceMode(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Detta gäller frånvaro
                <span className="block text-xs font-normal text-gray-600">
                  Lämna rutan tom för vanlig tidrapportering.
                </span>
              </span>
            </label>
          </div>
          )}

          {activeTab === 'create' && (isAbsenceMode ? (
            <>
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
                <label className="block text-sm font-medium mb-2">Typ av frånvaro:</label>
                <select
                  value={absenceType}
                  onChange={(e) => setAbsenceType(e.target.value as typeof absenceType)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {ABSENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <p className="block text-sm font-medium mb-2">Omfattning:</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                    <input
                      type="radio"
                      name="absenceScope"
                      checked={absenceIsFullDay}
                      onChange={() => setAbsenceIsFullDay(true)}
                    />
                    Hel dag
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                    <input
                      type="radio"
                      name="absenceScope"
                      checked={!absenceIsFullDay}
                      onChange={() => setAbsenceIsFullDay(false)}
                    />
                    Del av dag
                  </label>
                </div>
              </div>

              {!absenceIsFullDay && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Antal timmar:</label>
                  <HoursInput
                    value={absenceHours === '' ? null : absenceHours}
                    onChange={(hours) => setAbsenceHours(hours ?? '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Kommentar <span className="font-normal text-gray-500">(valfritt)</span>
                </label>
                <textarea
                  value={absenceNote}
                  onChange={(e) => setAbsenceNote(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  placeholder="T.ex. information till löneunderlaget"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Sparar...' : 'Spara frånvaro'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Avbryt
                </button>
              </div>
            </>
          ) : (
            <>
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
            <label className="block text-sm font-medium mb-2">
              Koppla till projekt <span className="font-normal text-gray-500">(valfritt)</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                const projectId = e.target.value
                setSelectedProjectId(projectId)
                const customerId = customerIdForSelectedProject(myProjects, projectId)
                if (customerId) setSelectedCustomer(customerId)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Inget projekt valt</option>
              {myProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Datum:</label>
            <input
              type="date"
              value={selectedDate}
              min={dateMin}
              max={dateMax}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Du kan välja datum bakåt i tiden om du behöver registrera arbetstid i efterhand.
            </p>
            <button
              type="button"
              onClick={copyFromPreviousDay}
              disabled={copyingPreviousDay || loading}
              className="mt-3 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {copyingPreviousDay ? 'Kopierar...' : 'Kopiera från föregående dag'}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              Hämtar kund, projekt, aktiviteter och referenser från dagen innan valt datum.
            </p>
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
                      Starttid <span className="font-normal text-gray-500">(för övertidsunderlag)</span>
                    </label>
                    <ClockTimeInput
                      value={entry.startTime}
                      onChange={(value) => updateEntry(index, 'startTime', value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Sluttid <span className="font-normal text-gray-500">(för övertidsunderlag)</span>
                    </label>
                    <ClockTimeInput
                      value={entry.endTime}
                      onChange={(value) => updateEntry(index, 'endTime', value)}
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

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Bilagor (bilder) <span className="font-normal text-gray-500">(valfritt)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPendingImages(Array.from(e.target.files || []))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
            />
            {pendingImages.length > 0 ? (
              <p className="mt-2 text-xs text-gray-600">{pendingImages.length} bild(er) kommer bifogas rapporten.</p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                Om du väljer projekt kopplas bilagorna dit, annars sparas de ändå på tidrapporten.
              </p>
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
            </>
          ))}

          {activeTab === 'submit' && (
          <div className="border-t border-gray-200 pt-6">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold" style={{ color: '#2D5016' }}>
                  Tidrapporter och inlämning
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Välj månad för att se, skicka in eller komplettera rapporter – även tidigare månader.
                </p>
              </div>
              <div className="sm:min-w-[220px]">
                <label className="block text-sm font-medium mb-1">Visa månad</label>
                <select
                  value={manageMonth}
                  onChange={(e) => setManageMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  {monthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthYearSv(monthKey)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {monthReminder ? (
              <MonthSubmissionReminder
                message={monthReminder.message}
                kind={monthReminder.kind}
                actionHref={null}
              />
            ) : null}

            <h3 className="text-base font-semibold mb-2" style={{ color: '#2D5016' }}>
              {formatMonthYearSv(currentMonth)}
              {isAdmin && reportForUser() && reportForUser()!.id !== currentUser?.id
                ? ` · ${reportForUser()!.name}`
                : ''}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Endast utkast visas här — inskickade rapporter finns under Mina rapporter. Kryssa i det du
              vill skicka till admin, eller använd &quot;Skicka alla utkast&quot;. Frånvaroutkast följer
              med vid &quot;Skicka alla utkast&quot;.
              {isAdmin && reportForUser() && reportForUser()!.id !== currentUser?.id
                ? ' Inlämning gäller den valda personens utkast.'
                : ''}
            </p>
            <div className="mb-5 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-700 font-semibold" style={{ color: '#2D5016' }}>
                Utkast för {formatMonthYearSv(currentMonth)}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {totalDraftCountThisMonth === 0
                  ? 'Inget att skicka in för denna månad.'
                  : `${totalDraftCountThisMonth} utkast att skicka in (${draftCountThisMonth} tid, ${draftAbsenceCountThisMonth} frånvaro)`}
              </div>
            </div>
            <MonthCustomerReportFolders
              groups={groupedMonthReports}
              totalDraftCount={totalDraftCountThisMonth}
              enableDraftSelection
              selectedReportIds={selectedReportIds}
              onToggleReport={toggleReportSelection}
              onToggleCustomerDrafts={toggleCustomerDrafts}
              onSelectAllDrafts={() => setSelectedReportIds(new Set(draftReportIdsThisMonth))}
              onClearSelection={() => setSelectedReportIds(new Set())}
              onSubmitSelected={() => {
                const ids = Array.from(selectedReportIds)
                if (ids.length === 0) {
                  alert('Välj minst en tidrapport att skicka in.')
                  return
                }
                setSubmitConfirm({ scope: 'selected', count: ids.length, reportIds: ids })
              }}
              onSubmitAllDrafts={() =>
                setSubmitConfirm({ scope: 'all', count: totalDraftCountThisMonth })
              }
              submitting={submittingMonth}
              submittingCustomerId={submittingCustomerId}
              onDeleteReport={(r) => setReportToDelete(r)}
              deletingReportId={deletingReportId}
            />

            <MonthAbsenceReportSection absences={draftMonthAbsences} />
          </div>
          )}
        </form>
      </div>

      <ConfirmDialog
        open={reportToDelete !== null}
        title="Ta bort tidrapport?"
        message={
          reportToDelete
            ? `Vill du ta bort tidrapporten för ${reportToDelete.customerName} den ${new Date(reportToDelete.date).toLocaleDateString('sv-SE')}? Detta går inte att ångra.`
            : ''
        }
        confirmLabel="Ja, ta bort"
        onCancel={() => {
          if (!deletingReportId) setReportToDelete(null)
        }}
        onConfirm={() => {
          if (reportToDelete) void deleteReport(reportToDelete.id)
        }}
      />

      <ConfirmDialog
        open={submitConfirm !== null}
        title={
          submitConfirm?.scope === 'selected'
            ? 'Skicka valda till admin?'
            : 'Skicka alla utkast till admin?'
        }
        message={
          submitConfirm
            ? submitConfirm.scope === 'selected'
              ? `Du skickar in ${submitConfirm.count} valda tidrapport${submitConfirm.count === 1 ? '' : 'er'} för ${formatMonthYearSv(currentMonth)} till admin. Admin skapar fakturor och skickar till kund. Fortsätta?`
              : `Du skickar in alla ${submitConfirm.count} utkast (som inte redan är inskickade) för ${formatMonthYearSv(currentMonth)} till admin, inklusive eventuell frånvaro. Fortsätta?`
            : ''
        }
        confirmLabel="Ja, skicka in"
        onCancel={() => setSubmitConfirm(null)}
        onConfirm={() => {
          if (!submitConfirm) return
          const pending = submitConfirm
          setSubmitConfirm(null)
          if (pending.scope === 'selected') {
            void submitMonthReports({ reportIds: pending.reportIds })
          } else {
            void submitMonthReports({ allDrafts: true })
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