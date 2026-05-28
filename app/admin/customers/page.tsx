'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Customer = {
  id: string
  name: string
  organizationNumber: string | null
  address: string | null
  information: string | null
  contactEmail: string | null
  archivedAt?: string | null
}

type ProjectEmployee = {
  completed: boolean
}

type Project = {
  id: string
  name: string
  customer: { id: string; name: string }
  startDate: string
  employees: ProjectEmployee[]
}

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [form, setForm] = useState({
    name: '',
    organizationNumber: '',
    address: '',
    contactEmail: '',
    information: '',
  })

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  )

  const customerProjectStats = useMemo(() => {
    const byCustomer: Record<string, { active: number; total: number; projects: Project[] }> = {}
    for (const p of projects) {
      const key = p.customer?.id
      if (!key) continue
      const bucket = byCustomer[key] ?? { active: 0, total: 0, projects: [] }
      bucket.total += 1
      bucket.projects.push(p)
      const hasIncompleteAssignment = p.employees.some((employee) => !employee.completed)
      if (hasIncompleteAssignment) bucket.active += 1
      byCustomer[key] = bucket
    }
    return byCustomer
  }, [projects])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return customers.filter((customer) => {
      if (!showArchived && customer.archivedAt) return false
      if (!needle) return true
      return (
        customer.name.toLowerCase().includes(needle) ||
        (customer.organizationNumber || '').toLowerCase().includes(needle) ||
        (customer.contactEmail || '').toLowerCase().includes(needle)
      )
    })
  }, [customers, search, showArchived])

  const setFormFromCustomer = (customer: Customer | null) => {
    setForm({
      name: customer?.name ?? '',
      organizationNumber: customer?.organizationNumber ?? '',
      address: customer?.address ?? '',
      contactEmail: customer?.contactEmail ?? '',
      information: customer?.information ?? '',
    })
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const [customersRes, projectsRes] = await Promise.all([
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (!customersRes.ok) throw new Error('Kunde inte hämta kunder')
      if (!projectsRes.ok) throw new Error('Kunde inte hämta projekt')

      const customerData: Customer[] = await customersRes.json()
      const projectData: Project[] = await projectsRes.json()
      setCustomers(customerData)
      setProjects(projectData)

      const nextSelected =
        (selectedCustomerId && customerData.some((c) => c.id === selectedCustomerId) && selectedCustomerId) ||
        customerData[0]?.id ||
        null
      setSelectedCustomerId(nextSelected)
      setFormFromCustomer(customerData.find((c) => c.id === nextSelected) ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte ladda sidan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { role?: string }
        if (parsed.role !== 'ENTREPRENEUR' && parsed.role !== 'PAYROLL_COORDINATOR') {
          window.location.href = '/time-report'
          return
        }
      } catch {
        window.location.href = '/login'
        return
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSelectCustomer = (customer: Customer) => {
    setCreatingNew(false)
    setSelectedCustomerId(customer.id)
    setFormFromCustomer(customer)
    setMessage('')
    setError('')
  }

  const onCreateCustomer = async () => {
    try {
      setSaving(true)
      setError('')
      setMessage('')
      if (!form.name.trim()) {
        setError('Kundnamn krävs')
        return
      }
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte skapa kund')
      setMessage('Kund skapad')
      await fetchData()
      setCreatingNew(false)
      setSelectedCustomerId(data.id)
      setFormFromCustomer(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte skapa kund')
    } finally {
      setSaving(false)
    }
  }

  const onSaveCustomer = async () => {
    if (!selectedCustomerId) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara kund')
      setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      setFormFromCustomer(data)
      setMessage('Kund uppdaterad')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara kund')
    } finally {
      setSaving(false)
    }
  }

  const onArchiveToggle = async (archive: boolean) => {
    if (!selectedCustomerId) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte ändra kundstatus')
      setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      setFormFromCustomer(data)
      setMessage(archive ? 'Kund arkiverad' : 'Kund återaktiverad')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte ändra kundstatus')
    } finally {
      setSaving(false)
    }
  }

  const onDeleteCustomer = async () => {
    if (!selectedCustomerId || !selectedCustomer) return
    const ok = window.confirm(`Radera kunden "${selectedCustomer.name}"?`)
    if (!ok) return
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte radera kund')
      setMessage('Kund raderad')
      setSelectedCustomerId(null)
      setCreatingNew(true)
      setForm({ name: '', organizationNumber: '', address: '', contactEmail: '', information: '' })
      await fetchData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte radera kund')
    } finally {
      setSaving(false)
    }
  }

  const selectedProjects = useMemo(() => {
    if (!selectedCustomerId) return []
    return projects
      .filter((p) => p.customer?.id === selectedCustomerId)
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
  }, [projects, selectedCustomerId])

  const selectedActiveProjects = selectedProjects.filter((project) =>
    project.employees.some((employee) => !employee.completed)
  )

  return (
    <div className="app-shell-wide">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#2D5016' }}>
          Aktiva kunder
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Hantera org.nr och kontaktuppgifter samt se aktiva projekt per kund.
        </p>

        {loading ? (
          <p>Laddar kunder...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 border border-gray-200 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Kundlista</h2>
              <div className="space-y-2 mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök kund, org.nr, e-post..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Visa arkiverade kunder
                </label>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-gray-500">Inga kunder ännu.</p>
                ) : (
                  filteredCustomers.map((customer) => {
                    const stats = customerProjectStats[customer.id] ?? { active: 0, total: 0, projects: [] }
                    const isSelected = selectedCustomerId === customer.id
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => onSelectCustomer(customer)}
                        className={`w-full text-left border rounded-md px-3 py-2 transition ${
                          isSelected
                            ? 'border-green-700 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-medium text-gray-900">
                          {customer.name}
                          {customer.archivedAt ? (
                            <span className="ml-2 text-xs font-normal text-amber-700">(Arkiverad)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-gray-600">
                          Aktiva projekt: {stats.active} / Totalt: {stats.total}
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-2 border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">
                  {creatingNew || !selectedCustomer ? 'Skapa ny kund' : 'Kunduppgifter'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew(true)
                    setSelectedCustomerId(null)
                    setMessage('')
                    setError('')
                    setForm({ name: '', organizationNumber: '', address: '', contactEmail: '', information: '' })
                  }}
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                >
                  Skapa ny kund
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Kundnamn *"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  value={form.organizationNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizationNumber: e.target.value }))}
                  placeholder="Organisationsnummer"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  value={form.contactEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="Kontakt e-post"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Adress"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
                <textarea
                  value={form.information}
                  onChange={(e) => setForm((prev) => ({ ...prev, information: e.target.value }))}
                  placeholder="Kontaktuppgifter / övrig information"
                  className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-md min-h-[90px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {creatingNew || !selectedCustomerId ? (
                  <button
                    type="button"
                    onClick={onCreateCustomer}
                    disabled={saving}
                    className="px-4 py-2 rounded-md text-white disabled:opacity-50"
                    style={{ backgroundColor: '#2D5016' }}
                  >
                    Skapa kund
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSaveCustomer}
                    disabled={saving}
                    className="px-4 py-2 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                  >
                    Spara ändringar
                  </button>
                )}
              </div>

              {!creatingNew && selectedCustomerId ? (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => onArchiveToggle(!selectedCustomer?.archivedAt)}
                    disabled={saving}
                    className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm disabled:opacity-50"
                  >
                    {selectedCustomer?.archivedAt ? 'Aktivera kund' : 'Avaktivera kund'}
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteCustomer}
                    disabled={saving}
                    className="px-3 py-2 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm disabled:opacity-50"
                  >
                    Radera kund
                  </button>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-green-700">{message}</p> : null}
            </div>
          </div>
        )}

        <div className="mt-6 border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Aktiva projekt för vald kund</h2>
          {!selectedCustomerId ? (
            <p className="text-sm text-gray-500">Välj en kund för att se projekt.</p>
          ) : selectedActiveProjects.length === 0 ? (
            <p className="text-sm text-gray-500">Inga aktiva projekt för vald kund.</p>
          ) : (
            <div className="space-y-2">
              {selectedActiveProjects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-md px-3 py-2">
                  <p className="font-medium text-gray-900">{project.name}</p>
                  <p className="text-xs text-gray-600">
                    Start: {new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' }).format(new Date(project.startDate))}
                  </p>
                  <Link
                    href={`/create-project?projectId=${encodeURIComponent(project.id)}`}
                    className="inline-block mt-1 text-xs font-medium underline"
                    style={{ color: '#2D5016' }}
                  >
                    Öppna projekt/redigering
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}