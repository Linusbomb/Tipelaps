'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type CustomerLite = {
  id: string
  name: string
  contactEmail?: string | null
}

type BundleReport = {
  id: string
  date: string
  month: string
  status: string
  user: { id: string; name: string }
}

type EmployeeOpt = { id: string; name: string }

type ProjectOpt = {
  id: string
  name: string
  startDate: string
  endBoundary: string
  assignedEmployeeCount: number
}

const statusSv: Record<string, string> = {
  SUBMITTED: 'Inlämnad',
  APPROVED: 'Godkänd',
}

function formatIsoDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('sv-SE')
  } catch {
    return dateStr
  }
}

/** Aktuell månad i YYYY-MM-format. */
function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Månadsalternativ YYYY-MM, nyast först. Från 2026 till och med innevarande månad. */
function buildMonthSelectOptions(): { value: string; label: string }[] {
  const list: { value: string; label: string }[] = []
  const now = new Date()
  const start = new Date(2026, 0, 1)
  const cur = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cur >= start) {
    const value = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    const raw = cur.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
    const label = raw.charAt(0).toUpperCase() + raw.slice(1)
    list.push({ value, label })
    cur.setMonth(cur.getMonth() - 1)
  }
  return list
}

export default function BundleToCustomerPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerLite[]>([])
  const [customerId, setCustomerId] = useState('')
  const [monthFilter, setMonthFilter] = useState<string>(() => currentMonthValue())
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [reports, setReports] = useState<BundleReport[]>([])
  const [employeesFromApi, setEmployeesFromApi] = useState<EmployeeOpt[]>([])
  const [projectsFromApi, setProjectsFromApi] = useState<ProjectOpt[]>([])
  const [allProjects, setAllProjects] = useState(true)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set())
  const [customerMeta, setCustomerMeta] = useState<CustomerLite | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loadingList, setLoadingList] = useState(false)
  const [busyAction, setBusyAction] = useState<'dl' | 'mail' | null>(null)

  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('Underlag tidrapporter')
  const [personalMessage, setPersonalMessage] = useState('')
  const [saveCustomerEmail, setSaveCustomerEmail] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const monthOptions = useMemo(() => buildMonthSelectOptions(), [])

  const filteredReports = useMemo(() => {
    if (!employeeFilter) return reports
    return reports.filter((r) => r.user.id === employeeFilter)
  }, [reports, employeeFilter])

  const monthFilterLabel = monthFilter
    ? monthOptions.find((o) => o.value === monthFilter)?.label ?? monthFilter
    : ''

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token) {
      window.location.href = '/login'
      return
    }
    if (userData) {
      const parsed = JSON.parse(userData)
      const ok = parsed.role === 'ENTREPRENEUR' || parsed.role === 'PAYROLL_COORDINATOR'
      if (!ok) {
        window.location.href = '/time-report'
        return
      }
    }

    const loadCustomers = async () => {
      const res = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
      }
    }
    loadCustomers()
  }, [])

  const projectIdsParam = useMemo(() => {
    if (allProjects) return ''
    const ids = Array.from(selectedProjectIds)
    return ids.length > 0 ? ids.join(',') : '__none__'
  }, [allProjects, selectedProjectIds])

  const fetchBundleData = useCallback(async () => {
    if (!customerId) return
    setFeedback(null)
    setLoadingList(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const params = new URLSearchParams({ customerId })
      if (employeeFilter) params.set('employeeId', employeeFilter)
      if (monthFilter.trim()) params.set('month', monthFilter.trim())
      if (projectIdsParam) params.set('projectIds', projectIdsParam)

      const res = await fetch(`/api/admin/time-reports/bundle-candidates?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setReports([])
        setEmployeesFromApi([])
        setProjectsFromApi([])
        setCustomerMeta(null)
        setSelected(new Set())
        setFeedback({ type: 'err', text: data.error ?? 'Kunde inte hämta listan' })
        return
      }

      setReports(data.reports ?? [])
      setEmployeesFromApi(data.employees ?? [])
      setProjectsFromApi(Array.isArray(data.projects) ? data.projects : [])
      if (data.customer) {
        setCustomerMeta(data.customer)
        const ce =
          typeof data.customer.contactEmail === 'string'
            ? data.customer.contactEmail
            : ''
        setToEmail((prev) => (prev.trim().length > 0 ? prev : ce))
      } else {
        setCustomerMeta(null)
      }
      setSelected(new Set())
    } catch {
      setFeedback({ type: 'err', text: 'Nätverksfel' })
    } finally {
      setLoadingList(false)
    }
  }, [customerId, employeeFilter, monthFilter, projectIdsParam])

  useEffect(() => {
    fetchBundleData()
  }, [fetchBundleData])

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleProject = (id: string) => {
    setAllProjects(false)
    setSelectedProjectIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      if (n.size === 0) {
        setAllProjects(true)
      }
      return n
    })
  }

  const handleAllProjectsToggle = (checked: boolean) => {
    if (checked) {
      setAllProjects(true)
      setSelectedProjectIds(new Set())
    } else {
      setAllProjects(false)
    }
  }

  const selectAllFiltered = () => {
    const ids = filteredReports.map((r) => r.id)
    setSelected(new Set(ids))
  }

  const clearSelection = () => setSelected(new Set())

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0) {
      setFeedback({ type: 'err', text: 'Välj minst en tidrapport.' })
      return
    }
    setBusyAction('dl')
    setFeedback(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/time-reports/bundle-download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportIds: selectedIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'err', text: err.error ?? 'Nedladdning misslyckades' })
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      const match = cd?.match(/filename="([^"]+)"/)
      const name = match?.[1] ?? `tidrapporter-${Date.now()}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      setFeedback({
        type: 'ok',
        text: `${selectedIds.length} rapport(er) sparades i Excel-filen.`,
      })
    } catch {
      setFeedback({ type: 'err', text: 'Nedladdning misslyckades (nätverksfel).' })
    } finally {
      setBusyAction(null)
    }
  }

  const handleSendEmail = async () => {
    if (selectedIds.length === 0) {
      setFeedback({ type: 'err', text: 'Välj minst en tidrapport.' })
      return
    }
    if (!toEmail.trim()) {
      setFeedback({ type: 'err', text: 'Ange mottagaradress.' })
      return
    }
    setBusyAction('mail')
    setFeedback(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/time-reports/bundle-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportIds: selectedIds,
          toEmail: toEmail.trim(),
          subject: subject.trim() || undefined,
          personalMessage,
          saveCustomerEmail: saveCustomerEmail && Boolean(customerMeta?.id),
          customerId: customerMeta?.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error ?? 'E-post misslyckades' })
        return
      }
      setFeedback({
        type: 'ok',
        text: `Skickade ${data.sentCount ?? selectedIds.length} rapport(er) till ${toEmail.trim()}.`,
      })
      if (saveCustomerEmail && customerMeta?.id && customerMeta) {
        setCustomerMeta({ ...customerMeta, contactEmail: toEmail.trim() })
      }
    } catch {
      setFeedback({ type: 'err', text: 'E-post misslyckades (nätverksfel).' })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      className="app-shell max-w-5xl"
      style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}
    >
      <div className="app-card mb-6">
        <h1 className="app-title mb-2" style={{ color: '#2D5016' }}>
          Tidrapporter till kund
        </h1>
        <p className="text-gray-700 mb-6">
          Välj kund och kryssa i de tidrapporter som ska ingå. Du kan sedan ladda ner dem som en
          Excel‑fil (.xlsx) eller skicka samma fil till kundens e‑post som underlag.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kund</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={customerId}
              onChange={(e) => {
                const id = e.target.value
                setCustomerId(id)
                setEmployeeFilter('')
                setMonthFilter(currentMonthValue())
                setAllProjects(true)
                setSelectedProjectIds(new Set())
                setProjectsFromApi([])
                const c = customers.find((x) => x.id === id)
                setToEmail(typeof c?.contactEmail === 'string' ? c.contactEmail : '')
              }}
            >
              <option value="">— Välj kund —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Månad</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value)
                setEmployeeFilter('')
              }}
              disabled={!customerId}
            >
              <option value="">Alla månader</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Visa bara tidrapporter för vald månad (rapportens månadsfält).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrera personal (valfritt)</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              disabled={!customerId || employeesFromApi.length === 0}
            >
              <option value="">Alla som har rapporter</option>
              {employeesFromApi.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {customerId && projectsFromApi.length > 0 && (
          <div className="mb-6 border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                Projekt för {customerMeta?.name ?? 'kund'}
              </h3>
              <span className="text-xs text-gray-500">
                {projectsFromApi.length} projekt
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-3 pb-3 border-b border-gray-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-green-800"
                checked={allProjects}
                onChange={(e) => handleAllProjectsToggle(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-800">
                Alla projekt (ingen filtrering på projekt)
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {projectsFromApi.map((p) => {
                const isChecked = !allProjects && selectedProjectIds.has(p.id)
                const start = (() => {
                  try {
                    return new Date(p.startDate).toLocaleDateString('sv-SE')
                  } catch {
                    return ''
                  }
                })()
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2 cursor-pointer select-none rounded-md border px-3 py-2 transition-colors ${
                      isChecked
                        ? 'border-green-800 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-green-700'
                    } ${allProjects ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5 accent-green-800"
                      checked={isChecked}
                      disabled={p.assignedEmployeeCount === 0}
                      onChange={() => toggleProject(p.id)}
                    />
                    <div className="text-sm flex-1">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        Start {start} · {p.assignedEmployeeCount} personal
                        {p.assignedEmployeeCount === 0 ? ' (ej tilldelad)' : ''}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Tidrapporter har ingen direkt projektkoppling, så filtreringen baseras på vilken
              personal som är tilldelad projektet och rapporternas datum (från projektstart till
              senaste avslut + marginal).
            </p>
          </div>
        )}

        {customerId && projectsFromApi.length === 0 && !loadingList && (
          <p className="text-xs text-gray-500 mb-4">
            Inga projekt registrerade för {customerMeta?.name ?? 'denna kund'} — alla rapporter
            visas.
          </p>
        )}

        {!customerId ? (
          <p className="text-gray-500">Välj en kund för att se godkända och inlämnade tidrapporter.</p>
        ) : loadingList ? (
          <p>Hämtar …</p>
        ) : filteredReports.length === 0 ? (
          <p className="text-gray-600">
            Inga lämpliga tidrapporter för denna kund
            {monthFilterLabel ? ` i ${monthFilterLabel}` : ''}
            {employeeFilter ? ' och vald personal' : ''}. (Endast status inlämnad eller godkänd.)
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-3">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-sm px-3 py-1.5 rounded border border-green-900 text-green-900 hover:bg-green-50"
              >
                Markera alla i listan
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-sm px-3 py-1.5 rounded border border-gray-400 hover:bg-gray-50"
              >
                Rensa val
              </button>
              <span className="text-sm text-gray-600 self-center">
                {selected.size} valda av {filteredReports.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Klicka på en rad för att öppna tidrapporten. Använd kryssrutan för att välja rapporter till Excel eller e‑post.
            </p>
            <div className="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="text-left p-2">Datum</th>
                    <th className="text-left p-2">Personal</th>
                    <th className="text-left p-2">Månad</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-gray-50/80 cursor-pointer focus-within:bg-gray-50/90"
                      onClick={() => router.push(`/admin/time-reports/${r.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(`/admin/time-reports/${r.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Öppna tidrapport ${formatIsoDate(r.date)} för ${r.user.name}`}
                    >
                      <td
                        className="p-2 align-middle"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 accent-green-800"
                          aria-label={`Välj tidrapport ${formatIsoDate(r.date)}`}
                        />
                      </td>
                      <td className="p-2">{formatIsoDate(r.date)}</td>
                      <td className="p-2">{r.user.name}</td>
                      <td className="p-2">{r.month}</td>
                      <td className="p-2">{statusSv[r.status] ?? r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold" style={{ color: '#2D5016' }}>
          Ladda ned eller skicka
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busyAction !== null || selectedIds.length === 0}
            onClick={handleDownloadZip}
            className="px-4 py-2 rounded-md font-medium text-white disabled:opacity-45"
            style={{ backgroundColor: '#2D5016' }}
          >
            {busyAction === 'dl' ? 'Skapar Excel…' : 'Ladda ner som Excel (.xlsx)'}
          </button>
        </div>

        <hr className="border-gray-200" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mottagarens e‑post</label>
            <input
              type="email"
              className="w-full border rounded-md px-3 py-2"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="exempel@kund.se"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ämnesrad</label>
            <input
              type="text"
              className="w-full border rounded-md px-3 py-2"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personligt meddelande till kunden (valfritt)
            </label>
            <textarea
              className="w-full border rounded-md px-3 py-2 min-h-[100px]"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={saveCustomerEmail}
            onChange={(e) => setSaveCustomerEmail(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            Spara e‑post på kunden (används nästa gång du väljer samma kund)
          </span>
        </label>

        <button
          type="button"
          disabled={busyAction !== null || selectedIds.length === 0}
          onClick={handleSendEmail}
          className="px-4 py-2 rounded-md font-medium border-2 disabled:opacity-45"
          style={{ borderColor: '#2D5016', color: '#2D5016' }}
        >
          {busyAction === 'mail' ? 'Skickar…' : 'Skicka Excel till kund'}
        </button>

        <p className="text-xs text-gray-500">
          Kräver SMTP (miljövariabler SMTP_*). Kontrollera konfigurationen om utskicket misslyckas.
        </p>

        {feedback && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              feedback.type === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  )
}
