'use client'

import { useEffect, useState } from 'react'
import {
  COMPANY_MODULE_DEFINITIONS,
  type CompanyModuleId,
} from '@/lib/companyModules'

const PRIMARY = '#2D5016'

type ModuleState = {
  moduleId: CompanyModuleId
  enabled: boolean
}

export default function SuperAdminCompanyModulesPanel({
  companyId,
  token,
}: {
  companyId: string
  token: string
}) {
  const [modules, setModules] = useState<ModuleState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    void loadModules()
  }, [companyId, token])

  async function loadModules() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte hämta moduler')
      setModules(Array.isArray(data.modules) ? data.modules : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta moduler')
    } finally {
      setLoading(false)
    }
  }

  function toggleModule(moduleId: CompanyModuleId) {
    if (moduleId === 'time_reports') return
    setModules((prev) =>
      prev.map((entry) =>
        entry.moduleId === moduleId ? { ...entry, enabled: !entry.enabled } : entry
      )
    )
  }

  async function saveModules() {
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/modules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ modules }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Kunde inte spara moduler')
      setModules(Array.isArray(data.modules) ? data.modules : modules)
      setInfo('Moduler sparade.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara moduler')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Laddar moduler…</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Välj vilka moduler kunden ska ha tillgång till. Tidrapportering är alltid aktiv.
      </p>
      <div className="space-y-2">
        {COMPANY_MODULE_DEFINITIONS.map((definition) => {
          const state = modules.find((entry) => entry.moduleId === definition.id)
          const enabled = definition.alwaysOn ? true : state?.enabled ?? true
          return (
            <label
              key={definition.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                definition.alwaysOn
                  ? 'border-gray-200 bg-gray-50 opacity-80'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={definition.alwaysOn || saving}
                onChange={() => toggleModule(definition.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2D5016] focus:ring-[#2D5016]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{definition.label}</span>
                <span className="block text-xs text-gray-600 mt-0.5">{definition.description}</span>
              </span>
            </label>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => void saveModules()}
        disabled={saving}
        className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: PRIMARY }}
      >
        {saving ? 'Sparar…' : 'Spara moduler'}
      </button>
      {info ? <p className="text-sm text-green-800">{info}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
