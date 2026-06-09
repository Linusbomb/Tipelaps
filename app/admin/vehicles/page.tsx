'use client'

import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import { VEHICLE_TYPES, vehicleTypeLabel } from '@/lib/companyVehicles'

type VehicleStatusFilter = 'active' | 'inactive' | 'deleted'

type CompanyVehicle = {
  id: string
  name: string | null
  type: string
  registrationNumber: string
  equipment: string | null
  archivedAt?: string | null
  deletedAt?: string | null
}

export default function AdminVehiclesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>('active')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [form, setForm] = useState<{
    name: string
    type: string
    registrationNumber: string
    equipment: string
  }>({
    name: '',
    type: VEHICLE_TYPES[0].value,
    registrationNumber: '',
    equipment: '',
  })

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )

  const filteredVehicles = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return vehicles
      .filter((vehicle) => {
        const isDeleted = Boolean(vehicle.deletedAt)
        const isInactive = Boolean(vehicle.archivedAt) && !isDeleted
        if (statusFilter === 'deleted') return isDeleted
        if (statusFilter === 'inactive') return isInactive
        return !isDeleted && !isInactive
      })
      .filter((vehicle) => {
        if (!needle) return true
        const hay = [
          vehicle.name,
          vehicle.registrationNumber,
          vehicleTypeLabel(vehicle.type),
          vehicle.equipment,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
  }, [vehicles, search, statusFilter])

  const token = () => localStorage.getItem('token') || ''

  const loadVehicles = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/vehicles?includeDeleted=true', {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) throw new Error('Kunde inte hämta fordon')
      const data = await res.json()
      setVehicles(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta fordon')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      type: VEHICLE_TYPES[0].value,
      registrationNumber: '',
      equipment: '',
    })
  }

  const selectVehicle = (vehicle: CompanyVehicle) => {
    setCreatingNew(false)
    setSelectedVehicleId(vehicle.id)
    setForm({
      name: vehicle.name || '',
      type: vehicle.type,
      registrationNumber: vehicle.registrationNumber,
      equipment: vehicle.equipment || '',
    })
    setMessage('')
    setError('')
  }

  const startCreate = () => {
    setCreatingNew(true)
    setSelectedVehicleId(null)
    resetForm()
    setMessage('')
    setError('')
  }

  const saveVehicle = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        name: form.name.trim() || null,
        type: form.type,
        registrationNumber: form.registrationNumber.trim(),
        equipment: form.equipment.trim() || null,
      }
      if (!payload.registrationNumber) {
        setError('Registreringsnummer krävs')
        return
      }

      const url = creatingNew ? '/api/vehicles' : `/api/vehicles/${selectedVehicleId}`
      const method = creatingNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara fordon')

      setMessage(creatingNew ? 'Fordon registrerat.' : 'Fordon uppdaterat.')
      await loadVehicles()
      setCreatingNew(false)
      setSelectedVehicleId(data.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara fordon')
    } finally {
      setSaving(false)
    }
  }

  const setArchiveState = async (archive: boolean) => {
    if (!selectedVehicleId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicleId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(archive ? { archive: true } : { active: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte uppdatera status')
      setMessage(archive ? 'Fordon inaktiverat.' : 'Fordon återaktiverat.')
      await loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte uppdatera status')
    } finally {
      setSaving(false)
    }
  }

  const deleteVehicle = async () => {
    if (!selectedVehicleId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte radera fordon')
      setMessage('Fordon raderat.')
      setSelectedVehicleId(null)
      setCreatingNew(false)
      resetForm()
      await loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte radera fordon')
    } finally {
      setSaving(false)
      setDeleteConfirmOpen(false)
    }
  }

  const restoreVehicle = async () => {
    if (!selectedVehicleId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicleId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ restore: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte återställa fordon')
      setMessage('Fordon återställt.')
      setStatusFilter('active')
      await loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte återställa fordon')
    } finally {
      setSaving(false)
      setRestoreConfirmOpen(false)
    }
  }

  const isDeleted = Boolean(selectedVehicle?.deletedAt)
  const isInactive = Boolean(selectedVehicle?.archivedAt) && !isDeleted

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {(['active', 'inactive', 'deleted'] as VehicleStatusFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  statusFilter === filter
                    ? 'bg-[#2D5016] text-white border-transparent'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {filter === 'active' ? 'Aktiva' : filter === 'inactive' ? 'Inaktiva' : 'Raderade'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: '#2D5016' }}
          >
            + Nytt fordon
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök reg.nr, typ eller namn…"
          className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-md"
        />

        {loading ? (
          <p className="text-sm text-gray-600">Laddar fordon…</p>
        ) : filteredVehicles.length === 0 ? (
          <p className="text-sm text-gray-600">Inga fordon i denna vy.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md max-h-[32rem] overflow-y-auto">
            {filteredVehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicleId
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => selectVehicle(vehicle)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                      selected ? 'bg-green-50' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {vehicleTypeLabel(vehicle.type)} ({vehicle.registrationNumber})
                    </div>
                    {vehicle.name ? (
                      <div className="text-sm text-gray-600">{vehicle.name}</div>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-gray-50/60">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#2D5016' }}>
          {creatingNew ? 'Registrera fordon' : selectedVehicle ? 'Redigera fordon' : 'Välj eller skapa fordon'}
        </h2>

        {message ? (
          <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        ) : null}

        {(creatingNew || selectedVehicle) && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Fordonstyp *</label>
              <select
                value={form.type}
                disabled={isDeleted || saving}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                {VEHICLE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Registreringsnummer *</label>
              <input
                type="text"
                value={form.registrationNumber}
                disabled={isDeleted || saving}
                onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Visningsnamn/maskinnummer <span className="font-normal text-gray-500">(valfritt)</span>
              </label>
              <input
                type="text"
                value={form.name}
                disabled={isDeleted || saving}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                placeholder="T.ex. maskin 12 eller Gul hjullastare"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nödvändig utrustning / info</label>
              <textarea
                value={form.equipment}
                disabled={isDeleted || saving}
                onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                rows={3}
                placeholder="T.ex. släp, snöblad, GPS…"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {!isDeleted ? (
                <button
                  type="button"
                  onClick={saveVehicle}
                  disabled={saving}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#2D5016' }}
                >
                  {saving ? 'Sparar…' : creatingNew ? 'Registrera' : 'Spara ändringar'}
                </button>
              ) : null}
              {selectedVehicle && !creatingNew && !isDeleted ? (
                isInactive ? (
                  <button
                    type="button"
                    onClick={() => setArchiveState(false)}
                    disabled={saving}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm"
                  >
                    Återaktivera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArchiveState(true)}
                    disabled={saving}
                    className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
                  >
                    Inaktivera
                  </button>
                )
              ) : null}
              {selectedVehicle && !creatingNew && !isDeleted ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={saving}
                  className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
                >
                  Radera
                </button>
              ) : null}
              {selectedVehicle && isDeleted ? (
                <button
                  type="button"
                  onClick={() => setRestoreConfirmOpen(true)}
                  disabled={saving}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: '#2D5016' }}
                >
                  Återställ fordon
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Radera fordon?"
        message="Fordonet flyttas till Raderade. Befintliga tidrapporter behåller historiken."
        confirmLabel="Radera"
        onConfirm={deleteVehicle}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      <ConfirmDialog
        open={restoreConfirmOpen}
        title="Återställ fordon?"
        message="Fordonet blir aktivt i registret igen och kan väljas i tidrapportering."
        confirmLabel="Återställ"
        onConfirm={restoreVehicle}
        onCancel={() => setRestoreConfirmOpen(false)}
      />
    </div>
  )
}
