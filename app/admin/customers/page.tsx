'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '@/app/components/ConfirmDialog'

type CustomerStatusFilter = 'active' | 'inactive' | 'deleted'

type Customer = {
  id: string
  name: string
  organizationNumber: string | null
  address: string | null
  information: string | null
  contactEmail: string | null
  archivedAt?: string | null
  deletedAt?: string | null
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
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('active')
  const [activeProjectsOnly, setActiveProjectsOnly] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [activeProjectsWarningOpen, setActiveProjectsWarningOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
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
    return customers
      .filter((customer) => {
        const isDeleted = Boolean(customer.deletedAt)
        const isInactive = Boolean(customer.archivedAt) && !isDeleted
        const isActive = !isDeleted && !customer.archivedAt

        if (statusFilter === 'active' && !isActive) return false
        if (statusFilter === 'inactive' && !isInactive) return false
        if (statusFilter === 'deleted' && !isDeleted) return false

        if (statusFilter === 'active' && activeProjectsOnly) {
          const activeCount = customerProjectStats[customer.id]?.active ?? 0
          if (activeCount === 0) return false
        }

        if (!needle) return true
        return (
          customer.name.toLowerCase().includes(needle) ||
          (customer.organizationNumber || '').toLowerCase().includes(needle) ||
          (customer.contactEmail || '').toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => {
        const activeA = customerProjectStats[a.id]?.active ?? 0
        const activeB = customerProjectStats[b.id]?.active ?? 0
        if (statusFilter === 'active' && activeB !== activeA) return activeB - activeA
        return a.name.localeCompare(b.name, 'sv')
      })
  }, [customers, search, statusFilter, activeProjectsOnly, customerProjectStats])

  const statusCounts = useMemo(() => {
    let active = 0
    let inactive = 0
    let deleted = 0
    for (const customer of customers) {
      if (customer.deletedAt) deleted += 1
      else if (customer.archivedAt) inactive += 1
      else active += 1
    }
    return { active, inactive, deleted }
  }, [customers])

  const isSelectedDeleted = Boolean(selectedCustomer?.deletedAt)

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
        fetch('/api/customers?includeDeleted=true', { headers: { Authorization: `Bearer ${token}` } }),
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
      setMessage(archive ? 'Kund markerad som inaktiv' : 'Kund aktiverad')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte ändra kundstatus')
    } finally {
      setSaving(false)
    }
  }

  const performDeleteCustomer = async () => {
    if (!selectedCustomerId || !selectedCustomer) return
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
      setMessage(`Kunden "${selectedCustomer.name}" har raderats`)
      setSelectedCustomerId(null)
      setCreatingNew(true)
      setForm({ name: '', organizationNumber: '', address: '', contactEmail: '', information: '' })
      setStatusFilter('deleted')
      await fetchData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte radera kund')
    } finally {
      setSaving(false)
      setDeleteConfirmOpen(false)
    }
  }

  const performRestoreCustomer = async () => {
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
        body: JSON.stringify({ restore: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte återställa kund')
      setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      setFormFromCustomer(data)
      setMessage('Kund återställd')
      setStatusFilter('active')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kunde inte återställa kund')
    } finally {
      setSaving(false)
      setRestoreConfirmOpen(false)
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

  const activeProjectsWarningMessage = useMemo(() => {
    if (selectedActiveProjects.length === 0) return ''
    const projectLines = selectedActiveProjects
      .slice(0, 5)
      .map((project) => `• ${project.name}`)
      .join('\n')
    const more =
      selectedActiveProjects.length > 5
        ? `\n… och ${selectedActiveProjects.length - 5} till`
        : ''
    return `Kunden har ${selectedActiveProjects.length} aktiva projekt som behöver avslutas innan kunden kan raderas.\n\n${projectLines}${more}`
  }, [selectedActiveProjects])

  const handleDeleteCustomerClick = () => {
    if (selectedActiveProjects.length > 0) {
      setActiveProjectsWarningOpen(true)
      return
    }
    setDeleteConfirmOpen(true)
  }

  return (
    <>
      <p className="text-sm text-gray-600 mb-6">
        Hantera org.nr och kontaktuppgifter samt se aktiva projekt per kund.
      </p>

      {loading ? (
          <p>Laddar kunder...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 border border-gray-200 rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Kundlista</h2>
              <div className="space-y-3 mb-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök kund, org.nr, e-post..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: 'active' as const, label: 'Aktiva', count: statusCounts.active },
                      { key: 'inactive' as const, label: 'Inaktiva', count: statusCounts.inactive },
                      { key: 'deleted' as const, label: 'Raderade', count: statusCounts.deleted },
                    ] as const
                  ).map((tab) => {
                    const isActive = statusFilter === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium border transition ${
                          isActive
                            ? 'text-white border-transparent'
                            : 'text-gray-700 border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                        style={isActive ? { backgroundColor: '#2D5016' } : undefined}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    )
                  })}
                </div>
                {statusFilter === 'active' ? (
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={activeProjectsOnly}
                      onChange={(e) => setActiveProjectsOnly(e.target.checked)}
                    />
                    Visa endast kunder med aktiva projekt
                  </label>
                ) : null}
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {statusFilter === 'deleted'
                      ? 'Inga raderade kunder.'
                      : statusFilter === 'inactive'
                        ? 'Inga inaktiva kunder.'
                        : 'Inga aktiva kunder.'}
                  </p>
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
                          {customer.deletedAt ? (
                            <span className="ml-2 text-xs font-normal text-red-700">(Raderad)</span>
                          ) : customer.archivedAt ? (
                            <span className="ml-2 text-xs font-normal text-amber-700">(Inaktiv)</span>
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
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                  disabled={isSelectedDeleted}
                />
                <input
                  value={form.organizationNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizationNumber: e.target.value }))}
                  placeholder="Organisationsnummer"
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                  disabled={isSelectedDeleted}
                />
                <input
                  value={form.contactEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="Kontakt e-post"
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                  disabled={isSelectedDeleted}
                />
                <input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Adress"
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                  disabled={isSelectedDeleted}
                />
                <textarea
                  value={form.information}
                  onChange={(e) => setForm((prev) => ({ ...prev, information: e.target.value }))}
                  placeholder="Kontaktuppgifter / övrig information"
                  className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-md min-h-[90px] disabled:bg-gray-100"
                  disabled={isSelectedDeleted}
                />
              </div>

              {isSelectedDeleted ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Denna kund är raderad och kan inte redigeras. Du kan återställa kunden om den ska bli aktiv igen.
                </p>
              ) : null}

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
                    disabled={saving || isSelectedDeleted}
                    className="px-4 py-2 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                  >
                    Spara ändringar
                  </button>
                )}
              </div>

              {!creatingNew && selectedCustomerId ? (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {isSelectedDeleted ? (
                    <button
                      type="button"
                      onClick={() => setRestoreConfirmOpen(true)}
                      disabled={saving}
                      className="px-3 py-2 rounded-md border border-green-700 bg-green-50 text-green-900 text-sm disabled:opacity-50"
                    >
                      Återställ kund
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onArchiveToggle(!selectedCustomer?.archivedAt)}
                        disabled={saving}
                        className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm disabled:opacity-50"
                      >
                        {selectedCustomer?.archivedAt ? 'Aktivera kund' : 'Gör inaktiv'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCustomerClick}
                        disabled={saving}
                        className="px-3 py-2 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm disabled:opacity-50"
                      >
                        Radera kund
                      </button>
                    </>
                  )}
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

      <ConfirmDialog
        open={activeProjectsWarningOpen}
        title="Kan inte radera kund"
        message={activeProjectsWarningMessage}
        alertOnly
        cancelLabel="OK"
        onCancel={() => setActiveProjectsWarningOpen(false)}
        onConfirm={() => setActiveProjectsWarningOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Radera kund"
        message={
          selectedCustomer
            ? `Är du säker på att du vill radera kunden "${selectedCustomer.name}"? Kunden flyttas till fliken Raderade och kan återställas senare.`
            : 'Är du säker på att du vill radera denna kund?'
        }
        confirmLabel="Ja, radera"
        cancelLabel="Avbryt"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void performDeleteCustomer()}
      />

      <ConfirmDialog
        open={restoreConfirmOpen}
        title="Återställ kund"
        message={
          selectedCustomer
            ? `Vill du återställa kunden "${selectedCustomer.name}"? Den blir aktiv igen i kundlistan.`
            : 'Vill du återställa denna kund?'
        }
        confirmLabel="Ja, återställ"
        cancelLabel="Avbryt"
        onCancel={() => setRestoreConfirmOpen(false)}
        onConfirm={() => void performRestoreCustomer()}
      />
    </>
  )
}