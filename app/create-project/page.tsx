'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import ModernDatePicker from '../components/DatePicker'
import SearchableSelect from '../components/SearchableSelect'
import RelatedProjectTimeReportsPanel from '../components/RelatedProjectTimeReportsPanel'
import { reverseGeocode } from '@/lib/geocoding'

interface Employee {
  id: string
  name: string
  email: string
}

interface Customer {
  id: string
  name: string
}

interface AddressSuggestion {
  display_name: string
  lat: string
  lon: string
}

interface CompanyProject {
  id: string
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  description?: string | null
  startDate: string
  createdAt?: string
  customer: {
    id: string
    name: string
  }
  employees: Array<{
    id: string
    accepted: boolean
    acceptedAt?: string | null
    completed?: boolean
    completedAt?: string | null
    assignedEquipment?: string | null
    user: {
      id: string
      name: string
      email: string
    }
  }>
  attachments?: Array<{
    id: string
    fileName: string
    createdAt: string
  }>
}

function formatDateTimeSv(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function dateValueMs(iso: string | undefined | null): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Senaste slutfört-tidstämpel på projektet (för lista «avslutade», nyast först). */
function latestEmployeeCompletedAtMs(project: CompanyProject): number {
  let max = 0
  for (const e of project.employees) {
    if (e.completed && e.completedAt) {
      max = Math.max(max, dateValueMs(e.completedAt))
    }
  }
  return max
}

function latestEmployeeCompletedAtDate(project: CompanyProject): Date | null {
  let latest: Date | null = null
  for (const e of project.employees) {
    if (!e.completed || !e.completedAt) continue
    const d = new Date(e.completedAt)
    if (Number.isNaN(d.getTime())) continue
    if (!latest || d.getTime() > latest.getTime()) {
      latest = d
    }
  }
  return latest
}

const PROJECT_LIST_PAGE_SIZE = 5

const EQUIPMENT_OPTIONS = [
  'Lastbil',
  'Kranbil',
  'Grävmaskin',
  'Hjullastare',
  'Minigrävare',
  'Dumper',
  'Vält',
  'Annat fordon/maskin',
]

type ProjectViewMode = 'create' | 'active'

const ProjectLocationMap = dynamic(() => import('../components/ProjectLocationMap'), {
  ssr: false,
})

export default function CreateProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get('projectId')
  const [user, setUser] = useState<any>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projectName, setProjectName] = useState('')
  const [address, setAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressSuggestionsOpen, setAddressSuggestionsOpen] = useState(false)
  const [addressSearchLoading, setAddressSearchLoading] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [mapZoom, setMapZoom] = useState(5)
  const [mapAddressLoading, setMapAddressLoading] = useState(false)
  const [startDate, setStartDate] = useState<Date | null>(new Date())
  const [customerId, setCustomerId] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [employeeEquipment, setEmployeeEquipment] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [activeProjects, setActiveProjects] = useState<CompanyProject[]>([])
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editAddressSuggestions, setEditAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [editAddressSuggestionsOpen, setEditAddressSuggestionsOpen] = useState(false)
  const [editAddressSearchLoading, setEditAddressSearchLoading] = useState(false)
  const [editLatitude, setEditLatitude] = useState<number | null>(null)
  const [editLongitude, setEditLongitude] = useState<number | null>(null)
  const [editMapCenter, setEditMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [editMapZoom, setEditMapZoom] = useState(5)
  const [editStartDate, setEditStartDate] = useState<Date | null>(new Date())
  const [editCustomerId, setEditCustomerId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSelectedEmployees, setEditSelectedEmployees] = useState<string[]>([])
  const [editEmployeeEquipment, setEditEmployeeEquipment] = useState<Record<string, string>>({})
  const [savingProjectEdit, setSavingProjectEdit] = useState(false)
  const [uploadingProjectImage, setUploadingProjectImage] = useState(false)
  const [adminCompletingKey, setAdminCompletingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false)
  /** Vilka avslutade projekt som är utfällda (för lazy laddning av tidrapporter). */
  const [completedProjectDetailsOpen, setCompletedProjectDetailsOpen] = useState<Record<string, boolean>>({})
  const [newCustomerName, setNewCustomerName] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  /** Antal projekt att visa i listorna; utökas med «Visa fler». */
  const [ongoingProjectsVisible, setOngoingProjectsVisible] = useState(PROJECT_LIST_PAGE_SIZE)
  const [completedProjectsVisible, setCompletedProjectsVisible] = useState(PROJECT_LIST_PAGE_SIZE)
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null)
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('create')
  const [activeProjectSearch, setActiveProjectSearch] = useState('')
  const [completedProjectSearch, setCompletedProjectSearch] = useState('')
  const [completedFilterYear, setCompletedFilterYear] = useState<number>(new Date().getFullYear())
  const [completedFilterMonth, setCompletedFilterMonth] = useState<'ALL' | number>('ALL')

  const ongoingProjectsList = useMemo(() => {
    const list = activeProjects.filter(
      (project) => !project.employees.some((employee) => employee.completed)
    )
    return [...list].sort((a, b) => {
      const startDiff = dateValueMs(b.startDate) - dateValueMs(a.startDate)
      if (startDiff !== 0) return startDiff
      return dateValueMs(b.createdAt) - dateValueMs(a.createdAt)
    })
  }, [activeProjects])

  const completedProjectsList = useMemo(() => {
    const list = activeProjects.filter((project) =>
      project.employees.some((employee) => employee.completed)
    )
    return [...list].sort((a, b) => {
      const doneDiff = latestEmployeeCompletedAtMs(b) - latestEmployeeCompletedAtMs(a)
      if (doneDiff !== 0) return doneDiff
      return dateValueMs(b.startDate) - dateValueMs(a.startDate)
    })
  }, [activeProjects])

  const filteredOngoingProjectsList = useMemo(() => {
    const needle = activeProjectSearch.trim().toLowerCase()
    if (!needle) return ongoingProjectsList
    return ongoingProjectsList.filter((project) => {
      const employeeBlob = project.employees.map((e) => e.user.name).join(' ').toLowerCase()
      return (
        project.name.toLowerCase().includes(needle) ||
        project.address.toLowerCase().includes(needle) ||
        project.customer.name.toLowerCase().includes(needle) ||
        employeeBlob.includes(needle)
      )
    })
  }, [ongoingProjectsList, activeProjectSearch])

  const completedYearOptions = useMemo(() => {
    const years = new Set<number>()
    for (const project of completedProjectsList) {
      const completedDate = latestEmployeeCompletedAtDate(project)
      if (completedDate) years.add(completedDate.getFullYear())
    }
    if (years.size === 0) years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [completedProjectsList])

  const filteredCompletedProjectsList = useMemo(() => {
    const needle = completedProjectSearch.trim().toLowerCase()
    return completedProjectsList.filter((project) => {
      const completedDate = latestEmployeeCompletedAtDate(project)
      if (!completedDate) return false
      if (completedDate.getFullYear() !== completedFilterYear) return false
      if (completedFilterMonth !== 'ALL' && completedDate.getMonth() !== completedFilterMonth) return false
      if (needle) {
        const employeeBlob = project.employees.map((e) => e.user.name).join(' ').toLowerCase()
        if (
          !project.name.toLowerCase().includes(needle) &&
          !project.address.toLowerCase().includes(needle) &&
          !project.customer.name.toLowerCase().includes(needle) &&
          !employeeBlob.includes(needle)
        ) {
          return false
        }
      }
      return true
    })
  }, [completedProjectsList, completedFilterYear, completedFilterMonth, completedProjectSearch])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      
      if (!token || !userData) {
        window.location.href = '/login'
        return
      }

      try {
        const parsedUser = JSON.parse(userData)
        if (parsedUser.role !== 'ENTREPRENEUR' && parsedUser.role !== 'PAYROLL_COORDINATOR') {
          window.location.href = '/time-report'
          return
        }

        setUser(parsedUser)
        fetchEmployees()
        fetchCustomers()
        fetchActiveProjects()
      } catch (err) {
        console.error('Fel vid parsing av användardata:', err)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (!requestedProjectId || activeProjects.length === 0) return
    const project = activeProjects.find((item) => item.id === requestedProjectId)
    if (!project) return
    setFocusedProjectId(requestedProjectId)
    openEditProject(project)
    const element = document.getElementById(`project-card-${requestedProjectId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open when deep-linking
  }, [requestedProjectId, activeProjects])

  useEffect(() => {
    setOngoingProjectsVisible(PROJECT_LIST_PAGE_SIZE)
  }, [activeProjectSearch])

  useEffect(() => {
    setCompletedProjectsVisible(PROJECT_LIST_PAGE_SIZE)
  }, [completedFilterYear, completedFilterMonth, completedProjectSearch])

  useEffect(() => {
    if (!completedYearOptions.includes(completedFilterYear)) {
      setCompletedFilterYear(completedYearOptions[0] ?? new Date().getFullYear())
    }
  }, [completedYearOptions, completedFilterYear])

  useEffect(() => {
    if (!editModalOpen) return
    const trimmedAddress = editAddress.trim()
    if (trimmedAddress.length < 3) {
      setEditAddressSuggestions([])
      setEditAddressSuggestionsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setEditAddressSearchLoading(true)
        const query = encodeURIComponent(`${trimmedAddress}, Sverige`)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&q=${query}&limit=6`
        )
        if (!response.ok) {
          setEditAddressSuggestions([])
          return
        }
        const data = (await response.json()) as AddressSuggestion[]
        const suggestions = Array.isArray(data) ? data : []
        setEditAddressSuggestions(suggestions)
        setEditAddressSuggestionsOpen(suggestions.length > 0)
      } catch (error) {
        console.error('Kunde inte geokoda adress i redigering:', error)
      } finally {
        setEditAddressSearchLoading(false)
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [editAddress, editModalOpen])

  useEffect(() => {
    const trimmedAddress = address.trim()
    if (trimmedAddress.length < 3) {
      setAddressSuggestions([])
      setAddressSuggestionsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setAddressSearchLoading(true)
        const query = encodeURIComponent(`${trimmedAddress}, Sverige`)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&q=${query}&limit=6`
        )
        if (!response.ok) {
          setAddressSuggestions([])
          return
        }
        const data = (await response.json()) as AddressSuggestion[]
        const suggestions = Array.isArray(data) ? data : []
        setAddressSuggestions(suggestions)
        setAddressSuggestionsOpen(suggestions.length > 0)
      } catch (error) {
        console.error('Kunde inte geokoda adress:', error)
      } finally {
        setAddressSearchLoading(false)
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [address])

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (err) {
      console.error('Kunde inte hämta anställda:', err)
    }
  }

  const fetchActiveProjects = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) return
      const data: CompanyProject[] = await response.json()
      // Visa alla projekt direkt efter skapande så admin alltid ser dem i listan.
      setActiveProjects(data)
    } catch (err) {
      console.error('Kunde inte hämta pågående projekt:', err)
    }
  }

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/customers?activeOnly=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
        if (data.length > 0) {
          setCustomerId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Kunde inte hämta kunder:', err)
    }
  }

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        const filtered = prev.filter(id => id !== employeeId)
        setEmployeeEquipment((current) => {
          const next = { ...current }
          delete next[employeeId]
          return next
        })
        return filtered
      } else {
        setEmployeeEquipment((current) => ({
          ...current,
          [employeeId]: current[employeeId] || EQUIPMENT_OPTIONS[0],
        }))
        return [...prev, employeeId]
      }
    })
  }

  const setEquipmentForEmployee = (employeeId: string, equipment: string) => {
    setEmployeeEquipment((current) => ({
      ...current,
      [employeeId]: equipment,
    }))
  }

  const openEditProject = (project: CompanyProject) => {
    setEditProjectId(project.id)
    setEditProjectName(project.name)
    setEditAddress(project.address)
    setEditLatitude(project.latitude ?? null)
    setEditLongitude(project.longitude ?? null)
    if (project.latitude != null && project.longitude != null) {
      setEditMapCenter({ lat: project.latitude, lng: project.longitude })
      setEditMapZoom(14)
    } else {
      setEditMapCenter(null)
      setEditMapZoom(5)
    }
    setEditStartDate(new Date(project.startDate))
    setEditCustomerId(project.customer.id)
    setEditDescription(project.description || '')
    setEditSelectedEmployees(project.employees.map((employee) => employee.user.id))
    setEditEmployeeEquipment(
      project.employees.reduce((acc: Record<string, string>, employee) => {
        acc[employee.user.id] = employee.assignedEquipment || EQUIPMENT_OPTIONS[0]
        return acc
      }, {})
    )
    setEditAddressSuggestions([])
    setEditAddressSuggestionsOpen(false)
    setEditModalOpen(true)
    setError('')
    setSuccess('')
  }

  const closeEditProject = () => {
    setEditModalOpen(false)
    setEditProjectId(null)
  }

  const selectEditAddressSuggestion = (suggestion: AddressSuggestion) => {
    const lat = Number(suggestion.lat)
    const lng = Number(suggestion.lon)
    setEditAddress(suggestion.display_name)
    setEditAddressSuggestionsOpen(false)
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setEditMapCenter({ lat, lng })
      setEditMapZoom(16)
      setEditLatitude(lat)
      setEditLongitude(lng)
    }
  }

  const toggleEditEmployee = (employeeId: string) => {
    setEditSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        const filtered = prev.filter((id) => id !== employeeId)
        setEditEmployeeEquipment((current) => {
          const next = { ...current }
          delete next[employeeId]
          return next
        })
        return filtered
      }
      setEditEmployeeEquipment((current) => ({
        ...current,
        [employeeId]: current[employeeId] || EQUIPMENT_OPTIONS[0],
      }))
      return [...prev, employeeId]
    })
  }

  const setEditEquipment = (employeeId: string, equipment: string) => {
    setEditEmployeeEquipment((current) => ({
      ...current,
      [employeeId]: equipment,
    }))
  }

  const saveEditedProject = async () => {
    if (!editProjectId) return
    if (!editProjectName.trim()) {
      setError('Projektnamn krävs')
      return
    }
    if (!editAddress.trim()) {
      setError('Adress krävs')
      return
    }
    if (!editStartDate) {
      setError('Startdatum krävs')
      return
    }
    if (editLatitude === null || editLongitude === null) {
      setError('Markera projektets exakta plats på kartan')
      return
    }
    if (!editCustomerId) {
      setError('Kund krävs')
      return
    }
    if (editSelectedEmployees.length === 0) {
      setError('Välj minst en anställd för projektet')
      return
    }
    const missingEquipment = editSelectedEmployees.find((employeeId) => !editEmployeeEquipment[employeeId])
    if (missingEquipment) {
      setError('Välj fordon för varje vald anställd')
      return
    }

    const notifyEmployees = window.confirm(
      'Vill du skicka e-postnotis till tilldelad personal om uppdateringen?'
    )

    try {
      setSavingProjectEdit(true)
      setError('')
      setSuccess('')

      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch(`/api/projects/${editProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editProjectName.trim(),
          address: editAddress.trim(),
          startDate: editStartDate.toISOString(),
          customerId: editCustomerId,
          latitude: editLatitude,
          longitude: editLongitude,
          description: editDescription.trim() || null,
          notifyEmployees,
          employeeAssignments: editSelectedEmployees.map((employeeId) => ({
            employeeId,
            equipment: editEmployeeEquipment[employeeId],
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte uppdatera projekt')
      }

      const notifyMsg =
        notifyEmployees && typeof data.notificationsSent === 'number'
          ? ` Notis skickad till ${data.notificationsSent} mottagare.`
          : ''
      setSuccess(`Projekt uppdaterat.${notifyMsg}`)
      closeEditProject()
      fetchActiveProjects()
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      setError(err.message || 'Något gick fel')
    } finally {
      setSavingProjectEdit(false)
    }
  }

  const uploadProjectImage = async (file: File) => {
    if (!editProjectId) return
    try {
      setUploadingProjectImage(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', editProjectId)
      const response = await fetch('/api/project-attachments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Kunde inte ladda upp bild')
      await fetchActiveProjects()
      setSuccess('Bild uppladdad till projektet')
      setTimeout(() => setSuccess(''), 2600)
    } catch (err: any) {
      setError(err.message || 'Kunde inte ladda upp bild')
    } finally {
      setUploadingProjectImage(false)
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) {
      setError('Ange ett kundnamn')
      return
    }

    setAddingCustomer(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCustomerName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa kund')
      }

      // Lägg till den nya kunden i listan
      setCustomers([...customers, data])
      setCustomerId(data.id) // Välj den nya kunden automatiskt
      setNewCustomerName('')
      setShowAddCustomerForm(false)
      setSuccess('Ny kund tillagd!')
      
      // Rensa success-meddelandet efter 3 sekunder
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingCustomer(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    // Validering
    if (!projectName.trim()) {
      setError('Projektnamn krävs')
      setLoading(false)
      return
    }

    if (!address.trim()) {
      setError('Adress krävs')
      setLoading(false)
      return
    }

    if (!startDate) {
      setError('Startdatum krävs')
      setLoading(false)
      return
    }
    if (latitude === null || longitude === null) {
      setError('Markera projektets exakta plats på kartan')
      setLoading(false)
      return
    }

    if (!customerId) {
      setError('Kund krävs')
      setLoading(false)
      return
    }

    if (selectedEmployees.length === 0) {
      setError('Välj minst en anställd')
      setLoading(false)
      return
    }

    const missingEquipment = selectedEmployees.find((employeeId) => !employeeEquipment[employeeId])
    if (missingEquipment) {
      setError('Välj fordon för varje vald anställd')
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName.trim(),
          address: address.trim(),
          latitude,
          longitude,
          startDate: startDate.toISOString(),
          customerId,
          employeeAssignments: selectedEmployees.map((employeeId) => ({
            employeeId,
            equipment: employeeEquipment[employeeId],
          })),
          description: description.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa projekt')
      }

      setSuccess('✅ Projekt skapat!')
      // Rensa formuläret
      setProjectName('')
      setAddress('')
      setLatitude(null)
      setLongitude(null)
      setMapCenter(null)
      setMapZoom(5)
      setStartDate(new Date())
      setCustomerId(customers.length > 0 ? customers[0].id : '')
      setSelectedEmployees([])
      setEmployeeEquipment({})
      setDescription('')
      fetchActiveProjects()
      
      // Rensa success-meddelandet efter 3 sekunder
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    const lat = Number(suggestion.lat)
    const lng = Number(suggestion.lon)
    setAddress(suggestion.display_name)
    setAddressSuggestionsOpen(false)
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setMapCenter({ lat, lng })
      setMapZoom(16)
      setLatitude(lat)
      setLongitude(lng)
    }
  }

  const applyMapLocation = async (
    { lat, lng }: { lat: number; lng: number },
    target: 'create' | 'edit'
  ) => {
    if (target === 'create') {
      setMapCenter({ lat, lng })
      setMapZoom(14)
      setLatitude(lat)
      setLongitude(lng)
    } else {
      setEditMapCenter({ lat, lng })
      setEditMapZoom(14)
      setEditLatitude(lat)
      setEditLongitude(lng)
    }

    setMapAddressLoading(true)
    try {
      const label = await reverseGeocode(lat, lng)
      if (!label) return
      if (target === 'create') {
        setAddress(label)
        setAddressSuggestions([])
        setAddressSuggestionsOpen(false)
      } else {
        setEditAddress(label)
        setEditAddressSuggestions([])
        setEditAddressSuggestionsOpen(false)
      }
    } catch (error) {
      console.error('Kunde inte slå upp adress från karta:', error)
    } finally {
      setMapAddressLoading(false)
    }
  }

  const adminCompleteEmployeeAssignment = async (
    projectId: string,
    userId: string,
    employeeName: string
  ) => {
    if (
      !window.confirm(
        `Markera som slutfört för ${employeeName}? Det motsvarar att personal själv trycker «Slutfört projekt».`
      )
    ) {
      return
    }
    const rowKey = `${projectId}-${userId}`
    setAdminCompletingKey(rowKey)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/projects/complete-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, userId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte slutföra tilldelningen')
      }
      await fetchActiveProjects()
      setSuccess('Tilldelning markerad som slutförd.')
      setTimeout(() => setSuccess(''), 3200)
    } catch (err: any) {
      setError(err.message || 'Kunde inte slutföra tilldelningen')
    } finally {
      setAdminCompletingKey(null)
    }
  }

  const adminReopenEmployeeAssignment = async (
    projectId: string,
    userId: string,
    employeeName: string
  ) => {
    if (
      !window.confirm(
        `Öppna upp projektet igen för ${employeeName}? Projektet flyttas tillbaka till aktiva projekt för personen och de kan markera slutfört på nytt vid behov.`
      )
    ) {
      return
    }
    const rowKey = `${projectId}-${userId}`
    setAdminCompletingKey(rowKey)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/projects/reopen-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId, userId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte öppna upp projektet')
      }
      await fetchActiveProjects()
      setSuccess(`Projektet är öppnat igen för ${employeeName}.`)
      setTimeout(() => setSuccess(''), 3200)
    } catch (err: any) {
      setError(err.message || 'Kunde inte öppna upp projektet')
    } finally {
      setAdminCompletingKey(null)
    }
  }

  if (!user) {
    return <div className="p-8">Laddar...</div>
  }

  return (
    <div className="app-shell-narrow">
      <div className="flex justify-between items-center mb-8">
        <h1 className="app-title text-gray-900">Skapa projekt</h1>
        <div className="flex items-center space-x-4">
          <a
            href="/admin"
            className="text-primary-600 hover:text-primary-700 px-3 py-2 rounded-md text-sm font-medium"
          >
            Admin
          </a>
          <span className="text-gray-700">Hej, {user.name}!</span>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logga ut
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setProjectViewMode('create')}
          className={`px-4 py-2 rounded-md text-sm font-medium border ${
            projectViewMode === 'create'
              ? 'text-white border-transparent'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          style={projectViewMode === 'create' ? { backgroundColor: '#2D5016' } : undefined}
        >
          Skapa projekt
        </button>
        <button
          type="button"
          onClick={() => setProjectViewMode('active')}
          className={`px-4 py-2 rounded-md text-sm font-medium border ${
            projectViewMode === 'active'
              ? 'text-white border-transparent'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          style={projectViewMode === 'active' ? { backgroundColor: '#2D5016' } : undefined}
        >
          Aktiva projekt
        </button>
      </div>

      {projectViewMode === 'create' && (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Nytt projekt</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
              Projektnamn *
            </label>
            <input
              type="text"
              id="projectName"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="T.ex. Byggprojekt Stockholm"
            />
          </div>

          <div className="relative z-[1200]">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Adress *
            </label>
            <input
              type="text"
              id="address"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setLatitude(null)
                setLongitude(null)
                setAddressSuggestionsOpen(true)
              }}
              onFocus={() => {
                if (addressSuggestions.length > 0) setAddressSuggestionsOpen(true)
              }}
              onBlur={() => window.setTimeout(() => setAddressSuggestionsOpen(false), 150)}
              placeholder="T.ex. Vinterstigen, Stockholm"
            />
            {addressSearchLoading && (
              <p className="mt-1 text-xs text-gray-500">Söker adresser...</p>
            )}
            {addressSuggestionsOpen && addressSuggestions.length > 0 && (
              <div
                className="absolute z-[1200] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg"
                onMouseDown={(event) => event.preventDefault()}
              >
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}-${suggestion.display_name}`}
                    type="button"
                    onClick={() => selectAddressSuggestion(suggestion)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-green-50"
                  >
                    {suggestion.display_name}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Börja skriva, t.ex. “Vinterstigen”, och välj rätt adress i listan.
            </p>
          </div>

          <div className="relative z-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Projektplats på karta *
            </label>
            <ProjectLocationMap
              latitude={latitude}
              longitude={longitude}
              mapCenter={mapCenter}
              zoom={mapZoom}
              onChange={(coords) => applyMapLocation(coords, 'create')}
            />
            {mapAddressLoading && (
              <p className="text-xs text-gray-500 mt-2">Hämtar adress från kartplats...</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Klicka på kartan för att markera plats – adressen fylls i automatiskt ovan. Välj «Flygfoto
              (hus och terräng)» om du vill se byggnader och tomt på riktigt; «Vägkarta» för en klassisk
              kartvy.
            </p>
            {latitude !== null && longitude !== null && (
              <p className="text-xs text-gray-600 mt-1">
                Vald position: {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Startdatum *
              </label>
              <ModernDatePicker
                id="startDate"
                selected={startDate}
                onChange={(newDate) => setStartDate(newDate)}
                placeholder="Välj startdatum"
                required
                minDate={new Date()}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="customerId" className="block text-sm font-medium text-gray-700">
                  Kund *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerForm(!showAddCustomerForm)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Ny kund
                </button>
              </div>
              {showAddCustomerForm && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Kundnamn
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="T.ex. Byggfirma AB"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomer()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomer}
                      disabled={addingCustomer || !newCustomerName.trim()}
                      className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {addingCustomer ? '...' : 'Lägg till'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCustomerForm(false)
                        setNewCustomerName('')
                      }}
                      className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
              <SearchableSelect
                id="customerId"
                options={customers}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Välj kund"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Välj personal *
            </label>
            <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-gray-500 text-sm">Inga anställda hittades</p>
              ) : (
                <div className="space-y-2">
                  {employees.map((employee) => (
                    <label
                      key={employee.id}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onChange={() => handleEmployeeToggle(employee.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-900">{employee.name}</span>
                      <span className="text-xs text-gray-500">({employee.email})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedEmployees.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-500">
                  {selectedEmployees.length} anställd{selectedEmployees.length > 1 ? 'a' : ''} vald{selectedEmployees.length > 1 ? 'a' : ''}
                </p>
                <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Tilldela fordon per anställd
                  </p>
                  <div className="space-y-2">
                    {selectedEmployees.map((employeeId) => {
                      const employee = employees.find((item) => item.id === employeeId)
                      if (!employee) return null
                      return (
                        <div key={employeeId} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                          <span className="text-sm text-gray-800">{employee.name}</span>
                          <select
                            value={employeeEquipment[employeeId] || EQUIPMENT_OPTIONS[0]}
                            onChange={(e) => setEquipmentForEmployee(employeeId, e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          >
                            {EQUIPMENT_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Nödvändig information
            </label>
            <textarea
              id="description"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Skriv nödvändig information om projektet..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Ytterligare information som kan vara relevant för projektet
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Skapar projekt...' : 'Skapa projekt'}
          </button>
        </form>
      </div>
      )}

      {projectViewMode === 'active' && (
      <div className="bg-white shadow rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Pågående projekt</h2>
        <p className="text-sm text-gray-600 mb-4">
          Om personal glömt att avsluta sitt pågående projekt kan du markera tilldelningen som slutförd här
          (samma som på deras sida «Mina projekt»). Expandera «Arbetade timmar och projektbilder» för
          godkända timmar, utkast och vem som har utkast kvar.
        </p>
        <div className="mb-4">
          <input
            type="text"
            value={activeProjectSearch}
            onChange={(e) => setActiveProjectSearch(e.target.value)}
            placeholder="Sök aktivt projekt (namn, kund, adress, personal)..."
            className="w-full max-w-xl px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        {filteredOngoingProjectsList.length === 0 ? (
          <p className="text-sm text-gray-500">Inga pågående projekt just nu.</p>
        ) : (
          <div className="space-y-4">
            {filteredOngoingProjectsList.slice(0, ongoingProjectsVisible).map((project) => (
              <div
                id={`project-card-${project.id}`}
                key={project.id}
                className={`border-2 rounded-md p-4 ${
                  focusedProjectId === project.id ? 'border-green-700 bg-green-50/40' : 'border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-800">
                      Pågående
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditProject(project)}
                      className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                    >
                      Redigera projekt
                    </button>
                  </div>
                </div>
                <p className="text-sm mt-1">
                  <strong>Accepterat:</strong>{' '}
                  {project.employees.filter((employee) => employee.accepted).length}/{project.employees.length}
                </p>
                <p className="text-sm text-gray-600 mt-1"><strong>Kund:</strong> {project.customer.name}</p>
                <p className="text-sm text-gray-600"><strong>Adress:</strong> {project.address}</p>
                <p className="text-sm text-gray-600">
                  <strong>Startdatum:</strong> {new Date(project.startDate).toLocaleDateString('sv-SE')}
                </p>
                {(project.attachments?.length ?? 0) > 0 ? (
                  <p className="text-sm text-gray-600">
                    <strong>Bilder:</strong> {project.attachments?.length}
                  </p>
                ) : null}
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Personal:</strong>
                  <ul className="mt-2 space-y-2 list-none">
                    {project.employees.map((employee) => {
                      const rowKey = `${project.id}-${employee.user.id}`
                      const showAdminComplete = !employee.completed && employee.accepted
                      const showAdminReopen = employee.completed
                      return (
                        <li
                          key={employee.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50/80 px-3 py-2"
                        >
                          <span>
                            <span className="font-medium text-gray-900">{employee.user.name}</span>
                            {employee.assignedEquipment ? ` (${employee.assignedEquipment})` : ''}
                            <span className="text-gray-600">
                              {' — '}
                              {employee.completed
                                ? 'Slutfört'
                                : employee.accepted
                                  ? 'Accepterat, inte slutfört'
                                  : 'Ej accepterat'}
                            </span>
                          </span>
                          {showAdminComplete ? (
                            <button
                              type="button"
                              onClick={() =>
                                adminCompleteEmployeeAssignment(
                                  project.id,
                                  employee.user.id,
                                  employee.user.name
                                )
                              }
                              disabled={adminCompletingKey === rowKey}
                              className="shrink-0 text-xs font-medium px-2 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {adminCompletingKey === rowKey ? 'Sparar...' : 'Slutför åt personal'}
                            </button>
                          ) : showAdminReopen ? (
                            <button
                              type="button"
                              onClick={() =>
                                adminReopenEmployeeAssignment(
                                  project.id,
                                  employee.user.id,
                                  employee.user.name
                                )
                              }
                              disabled={adminCompletingKey === rowKey}
                              className="shrink-0 text-xs font-medium px-2 py-1 rounded border border-amber-700 text-amber-950 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {adminCompletingKey === rowKey ? 'Sparar...' : 'Öppna upp igen'}
                            </button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 open:bg-white">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-green-900 list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
                    <span>Arbetade timmar och projektbilder</span>
                    <span className="text-xs font-normal text-slate-500 group-open:hidden">Visa</span>
                  </summary>
                  <RelatedProjectTimeReportsPanel
                    projectId={project.id}
                    fallbackAttachments={project.attachments}
                  />
                </details>
              </div>
            ))}
            {filteredOngoingProjectsList.length > ongoingProjectsVisible ? (
              <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100">
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600 hover:text-primary-800 underline underline-offset-2"
                  onClick={() =>
                    setOngoingProjectsVisible((n) =>
                      Math.min(n + PROJECT_LIST_PAGE_SIZE, filteredOngoingProjectsList.length)
                    )
                  }
                >
                  Visa fler — {filteredOngoingProjectsList.length - ongoingProjectsVisible} kvar
                </button>
              </div>
            ) : null}
            {ongoingProjectsVisible > PROJECT_LIST_PAGE_SIZE && filteredOngoingProjectsList.length > PROJECT_LIST_PAGE_SIZE ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  onClick={() => setOngoingProjectsVisible(PROJECT_LIST_PAGE_SIZE)}
                >
                  Visa färre (dölj extra projekt)
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      )}

      {projectViewMode === 'active' && (
      <div className="bg-white shadow rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold mb-2">Avslutade projekt</h2>
        <p className="text-sm text-gray-600 mb-4">
          Klicka på ett projekt för plats, bilder, godkända timmar, utkast (och vem som har kvar i utkast) samt
          vilka som slutfört. Tidrapporterna matchas mot projektperioden, kunden och tilldelad personal.
        </p>
        <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="w-full sm:flex-1 sm:min-w-[240px]">
            <label className="block text-xs text-gray-500 mb-1">Sök</label>
            <input
              type="search"
              value={completedProjectSearch}
              onChange={(e) => setCompletedProjectSearch(e.target.value)}
              placeholder="Sök namn, kund, adress eller personal..."
              className="w-full max-w-xl px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">År</label>
            <select
              value={completedFilterYear}
              onChange={(e) => setCompletedFilterYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              {completedYearOptions.map((year) => (
                <option key={`completed-year-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Månad</label>
            <select
              value={String(completedFilterMonth)}
              onChange={(e) =>
                setCompletedFilterMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="ALL">Alla månader</option>
              {Array.from({ length: 12 }, (_, idx) => (
                <option key={`completed-month-${idx}`} value={idx}>
                  {new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(new Date(2026, idx, 1))}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filteredCompletedProjectsList.length === 0 ? (
          <p className="text-sm text-gray-500">Inga avslutade projekt ännu.</p>
        ) : (
          <div className="space-y-3">
            {filteredCompletedProjectsList.slice(0, completedProjectsVisible).map((project) => (
                <details
                  id={`project-card-${project.id}`}
                  key={project.id}
                  className={`group border rounded-lg open:bg-white ${
                    focusedProjectId === project.id
                      ? 'border-green-700 bg-green-50/40 open:border-green-700'
                      : 'border-emerald-300 bg-emerald-50/50 open:border-gray-300'
                  }`}
                  onToggle={(e) => {
                    const open = e.currentTarget.open
                    setCompletedProjectDetailsOpen((prev) => ({ ...prev, [project.id]: open }))
                  }}
                >
                  <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-900 text-lg block">{project.name}</span>
                      {latestEmployeeCompletedAtDate(project) ? (
                        <span className="text-xs text-emerald-900 mt-0.5 block">
                          Senast slutfört:{' '}
                          {formatDateTimeSv(latestEmployeeCompletedAtDate(project)!.toISOString())}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-700 text-white">
                        Avslutat
                      </span>
                      <span className="text-xs font-medium px-2 py-1 rounded border border-emerald-800 text-emerald-900 group-open:hidden">
                        Visa
                      </span>
                      <span className="hidden text-xs font-medium px-2 py-1 rounded border border-gray-400 text-gray-700 group-open:inline">
                        Dölj
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-gray-200 px-4 py-4 space-y-4 text-sm text-gray-700">
                    <div>
                      <p>
                        <span className="text-gray-500">Kund</span>{' '}
                        <span className="font-medium text-gray-900">{project.customer.name}</span>
                      </p>
                      <p className="mt-1">
                        <strong className="text-gray-600">Adress:</strong> {project.address}
                      </p>
                      <p className="mt-1">
                        <strong className="text-gray-600">Startdatum:</strong>{' '}
                        {new Date(project.startDate).toLocaleDateString('sv-SE')}
                      </p>
                    </div>

                    {project.description?.trim() ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Information om projektet
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-gray-900">{project.description}</p>
                      </div>
                    ) : null}

                    {project.latitude != null &&
                    project.longitude != null &&
                    !Number.isNaN(project.latitude) &&
                    !Number.isNaN(project.longitude) ? (
                      <p>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${project.latitude}&mlon=${project.longitude}&zoom=16`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-800 underline hover:text-green-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Öppna plats på karta
                        </a>
                        <span className="text-gray-400 ml-2 text-xs">
                          ({project.latitude.toFixed(5)}, {project.longitude.toFixed(5)})
                        </span>
                      </p>
                    ) : null}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                        Tilldelningar
                      </p>
                      <ul className="space-y-2">
                        {project.employees.map((employee) => (
                          <li
                            key={employee.id}
                            className={`rounded-md border px-3 py-2 ${
                              employee.completed
                                ? 'border-emerald-200 bg-emerald-50/80'
                                : 'border-amber-200 bg-amber-50/80'
                            }`}
                          >
                            <span className="font-medium text-gray-900">{employee.user.name}</span>{' '}
                            <span className="text-gray-500 text-xs">({employee.user.email})</span>
                            {employee.assignedEquipment ? (
                              <span className="block text-xs text-gray-600 mt-0.5">
                                Utrustning: {employee.assignedEquipment}
                              </span>
                            ) : null}
                            <span className="block text-xs mt-1">
                              {employee.completed ? (
                                <>
                                  Markerat slutfört:{' '}
                                  <strong>{formatDateTimeSv(employee.completedAt)}</strong>
                                </>
                              ) : employee.accepted ? (
                                <>
                                  Fortfarande pågående (accepterat {formatDateTimeSv(employee.acceptedAt)})
                                </>
                              ) : (
                                <>Inte accepterat ännu</>
                              )}
                            </span>
                            {!employee.completed && employee.accepted ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    adminCompleteEmployeeAssignment(
                                      project.id,
                                      employee.user.id,
                                      employee.user.name
                                    )
                                  }}
                                  disabled={adminCompletingKey === `${project.id}-${employee.user.id}`}
                                  className="text-xs font-medium px-2 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                                >
                                  {adminCompletingKey === `${project.id}-${employee.user.id}`
                                    ? 'Sparar...'
                                    : 'Slutför åt personal'}
                                </button>
                              </div>
                            ) : employee.completed ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    adminReopenEmployeeAssignment(
                                      project.id,
                                      employee.user.id,
                                      employee.user.name
                                    )
                                  }}
                                  disabled={adminCompletingKey === `${project.id}-${employee.user.id}`}
                                  className="text-xs font-medium px-2 py-1 rounded border border-amber-700 text-amber-950 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  {adminCompletingKey === `${project.id}-${employee.user.id}`
                                    ? 'Sparar...'
                                    : 'Öppna upp igen för personal'}
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {completedProjectDetailsOpen[project.id] ? (
                      <RelatedProjectTimeReportsPanel
                        projectId={project.id}
                        fallbackAttachments={project.attachments}
                      />
                    ) : null}
                  </div>
                </details>
              ))}
            {filteredCompletedProjectsList.length > completedProjectsVisible ? (
              <div className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-emerald-100">
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600 hover:text-primary-800 underline underline-offset-2"
                  onClick={() =>
                    setCompletedProjectsVisible((n) =>
                      Math.min(n + PROJECT_LIST_PAGE_SIZE, filteredCompletedProjectsList.length)
                    )
                  }
                >
                  Visa fler — {filteredCompletedProjectsList.length - completedProjectsVisible} kvar
                </button>
              </div>
            ) : null}
            {completedProjectsVisible > PROJECT_LIST_PAGE_SIZE &&
            filteredCompletedProjectsList.length > PROJECT_LIST_PAGE_SIZE ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                  onClick={() => setCompletedProjectsVisible(PROJECT_LIST_PAGE_SIZE)}
                >
                  Visa färre (dölj extra projekt)
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/45 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-200 my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Redigera projekt</h2>
                <p className="text-sm text-gray-600 mt-1">Uppdatera all projektinformation och tilldelad personal.</p>
              </div>
              <button
                type="button"
                onClick={closeEditProject}
                className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md"
                aria-label="Stäng"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projektnamn *</label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="relative z-[1200]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Adress *</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => {
                    setEditAddress(e.target.value)
                    setEditAddressSuggestionsOpen(true)
                  }}
                  onFocus={() => {
                    if (editAddressSuggestions.length > 0) setEditAddressSuggestionsOpen(true)
                  }}
                  onBlur={() => window.setTimeout(() => setEditAddressSuggestionsOpen(false), 150)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {editAddressSearchLoading && (
                  <p className="mt-1 text-xs text-gray-500">Söker adresser...</p>
                )}
                {editAddressSuggestionsOpen && editAddressSuggestions.length > 0 && (
                  <div
                    className="absolute z-[1200] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {editAddressSuggestions.map((suggestion) => (
                      <button
                        key={`edit-${suggestion.lat}-${suggestion.lon}-${suggestion.display_name}`}
                        type="button"
                        onClick={() => selectEditAddressSuggestion(suggestion)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-green-50"
                      >
                        {suggestion.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Projektplats på karta *</label>
                <ProjectLocationMap
                  latitude={editLatitude}
                  longitude={editLongitude}
                  mapCenter={editMapCenter}
                  zoom={editMapZoom}
                  onChange={(coords) => applyMapLocation(coords, 'edit')}
                />
                {mapAddressLoading && (
                  <p className="text-xs text-gray-500 mt-2">Hämtar adress från kartplats...</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum *</label>
                  <ModernDatePicker
                    selected={editStartDate}
                    onChange={(newDate) => setEditStartDate(newDate)}
                    placeholder="Välj startdatum"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kund *</label>
                  <SearchableSelect
                    options={customers}
                    value={editCustomerId}
                    onChange={setEditCustomerId}
                    placeholder="Välj kund"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nödvändig information</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Beskrivning och övrig information..."
                />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Tilldelad personal och fordon *</p>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {employees.map((employee) => (
                    <label
                      key={`edit-modal-${employee.id}`}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-2 rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editSelectedEmployees.includes(employee.id)}
                          onChange={() => toggleEditEmployee(employee.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{employee.name}</span>
                      </div>
                      {editSelectedEmployees.includes(employee.id) && (
                        <select
                          value={editEmployeeEquipment[employee.id] || EQUIPMENT_OPTIONS[0]}
                          onChange={(e) => setEditEquipment(employee.id, e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          {EQUIPMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Projektbilder</p>
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm cursor-pointer hover:bg-gray-50">
                    {uploadingProjectImage ? 'Laddar upp...' : 'Ladda upp bild'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingProjectImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadProjectImage(file)
                        e.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-500">
                    Bilderna blir synliga för admin i projektet.
                  </span>
                </div>
                {(activeProjects.find((p) => p.id === editProjectId)?.attachments || []).length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {(activeProjects.find((p) => p.id === editProjectId)?.attachments || []).map((att) => (
                      <li key={att.id}>
                        - {att.fileName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">Inga bilder uppladdade ännu.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={closeEditProject}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={saveEditedProject}
                disabled={savingProjectEdit}
                className="px-4 py-2 rounded-md text-white disabled:opacity-50"
                style={{ backgroundColor: '#2D5016' }}
              >
                {savingProjectEdit ? 'Sparar...' : 'Spara projekt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
