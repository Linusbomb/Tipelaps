'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Employee = {
  id: string
  name: string
  email: string
  phone?: string | null
  employeeCategory?: string | null
  role: string
  createdAt: string
}

export default function MyStaffPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    passwordSetupMethod: 'EMAIL_LINK',
    password: '',
  })
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resendingSetupUserId, setResendingSetupUserId] = useState<string | null>(null)
  const [vacationYear, setVacationYear] = useState(new Date().getFullYear())
  const [vacationByEmployee, setVacationByEmployee] = useState<Record<string, number[]>>({})
  const [savingVacationUserId, setSavingVacationUserId] = useState<string | null>(null)
  const [resettingVacation, setResettingVacation] = useState(false)
  const [savedVacationByEmployee, setSavedVacationByEmployee] = useState<Record<string, boolean>>({})
  const [loadingVacation, setLoadingVacation] = useState(false)
  const [message, setMessage] = useState('')
  const [employeePendingRemove, setEmployeePendingRemove] = useState<Employee | null>(null)
  const [removingEmployeeId, setRemovingEmployeeId] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [searchTerm, sortBy])

  useEffect(() => {
    fetchVacationPlanning()
  }, [vacationYear])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      if (!token) {
        window.location.href = '/login'
        return
      }
      if (userData) {
        const parsed = JSON.parse(userData)
        const isAdminUser = parsed.role === 'ENTREPRENEUR' || parsed.role === 'PAYROLL_COORDINATOR'
        if (!isAdminUser) {
          window.location.href = '/time-report'
          return
        }
      }

      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('search', searchTerm.trim())
      params.set('sort', sortBy)

      const response = await fetch(`/api/admin/employees?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        window.location.href = '/login'
        return
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte hämta personal')
      }

      setEmployees(data)
    } catch (err: any) {
      setError(err.message || 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    setEmployeeLoading(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(employeeForm),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skapa personal')
      }

      setMessage(`Personal skapad: ${data.employee.email}`)
      setEmployeeForm({
        name: '',
        email: '',
        phone: '',
        role: 'EMPLOYEE',
        passwordSetupMethod: 'EMAIL_LINK',
        password: '',
      })
      fetchEmployees()
    } catch (err: any) {
      setError(err.message || 'Något gick fel')
    } finally {
      setEmployeeLoading(false)
    }
  }

  const resendSetupEmail = async (employeeId: string) => {
    try {
      setResendingSetupUserId(employeeId)
      setMessage('')
      setError('')

      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/admin/employees/resend-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employeeId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka aktiveringsmejl')
      }

      setMessage('Aktiveringsmejl skickat')
    } catch (err: any) {
      setError(err.message || 'Något gick fel')
    } finally {
      setResendingSetupUserId(null)
    }
  }

  const removeEmployeeConfirm = async () => {
    if (!employeePendingRemove) return
    const removedId = employeePendingRemove.id
    try {
      setRemovingEmployeeId(removedId)
      setMessage('')
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const response = await fetch(`/api/admin/employees/${removedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ta bort personal')
      }
      setEmployeePendingRemove(null)
      setMessage(typeof data.message === 'string' ? data.message : 'Personal är borttagen.')
      setVacationByEmployee((prev) => {
        const next = { ...prev }
        delete next[removedId]
        return next
      })
      setSavedVacationByEmployee((prev) => {
        const next = { ...prev }
        delete next[removedId]
        return next
      })
      fetchEmployees()
      fetchVacationPlanning()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Något gick fel'
      setError(msg)
    } finally {
      setRemovingEmployeeId(null)
    }
  }

  const fetchVacationPlanning = async () => {
    try {
      setLoadingVacation(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/admin/vacation-planning?year=${vacationYear}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) return

      const data = await response.json()
      const grouped: Record<string, number[]> = {}
      ;(data.vacations || []).forEach((entry: { userId: string; week: number }) => {
        if (!grouped[entry.userId]) grouped[entry.userId] = []
        grouped[entry.userId].push(entry.week)
      })
      Object.keys(grouped).forEach((userId) => {
        grouped[userId] = grouped[userId].sort((a, b) => a - b)
      })
      setVacationByEmployee(grouped)
      setSavedVacationByEmployee({})
    } catch (err) {
      console.error('Fel vid hämtning av semesterplanering:', err)
    } finally {
      setLoadingVacation(false)
    }
  }

  const toggleVacationWeek = (userId: string, week: number) => {
    setSavedVacationByEmployee((prev) => ({
      ...prev,
      [userId]: false,
    }))
    setVacationByEmployee((prev) => {
      const existing = prev[userId] || []
      const hasWeek = existing.includes(week)
      const updated = hasWeek ? existing.filter((w) => w !== week) : [...existing, week]
      return {
        ...prev,
        [userId]: updated.sort((a, b) => a - b),
      }
    })
  }

  const saveVacationWeeks = async (userId: string) => {
    try {
      setSavingVacationUserId(userId)
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('/api/admin/vacation-planning', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          year: vacationYear,
          weeks: vacationByEmployee[userId] || [],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte spara semesterveckor')
      }

      setSavedVacationByEmployee((prev) => ({
        ...prev,
        [userId]: true,
      }))
    } catch (error: any) {
      alert(error.message || 'Kunde inte spara semesterveckor')
    } finally {
      setSavingVacationUserId(null)
    }
  }

  const resetVacationWeeks = async () => {
    const confirmed = window.confirm('Vill du verkligen nollställa semester?')
    if (!confirmed) return

    try {
      setResettingVacation(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(`/api/admin/vacation-planning?year=${vacationYear}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte nollställa semesterveckor')
      }

      setVacationByEmployee({})
      setSavedVacationByEmployee({})
    } catch (error: any) {
      alert(error.message || 'Kunde inte nollställa semesterveckor')
    } finally {
      setResettingVacation(false)
    }
  }

  return (
    <div className="app-shell" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="app-card">
        <h1 className="app-title mb-6" style={{ color: '#2D5016' }}>
          Personal
        </h1>

        <div className="mb-8 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#2D5016' }}>
            Lägg till personal
          </h2>
          <form onSubmit={createEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Namn"
              value={employeeForm.name}
              onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="email"
              required
              placeholder="E-post"
              value={employeeForm.email}
              onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={employeeForm.passwordSetupMethod}
              onChange={(e) => setEmployeeForm({ ...employeeForm, passwordSetupMethod: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="EMAIL_LINK">Skicka länk för att skapa lösenord</option>
              <option value="ADMIN_PASSWORD">Admin anger lösenord direkt</option>
            </select>
            <input
              type="password"
              minLength={6}
              required={employeeForm.passwordSetupMethod === 'ADMIN_PASSWORD'}
              disabled={employeeForm.passwordSetupMethod !== 'ADMIN_PASSWORD'}
              placeholder={
                employeeForm.passwordSetupMethod === 'ADMIN_PASSWORD'
                  ? 'Lösenord (minst 6 tecken)'
                  : 'Lösenord sätts via e-postlänk'
              }
              value={employeeForm.password}
              onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={employeeForm.role}
              onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="EMPLOYEE">Personal</option>
              <option value="PAYROLL_COORDINATOR">Admin</option>
            </select>
            <input
              type="tel"
              placeholder="Telefon (valfritt)"
              value={employeeForm.phone}
              onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="submit"
              disabled={employeeLoading}
              className="md:col-span-2 px-4 py-2 text-white rounded-md disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {employeeLoading ? 'Skapar...' : 'Skapa användare'}
            </button>
          </form>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Sök personal:</label>
            <input
              type="text"
              placeholder="Namn eller e-post"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sortera:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="name_asc">Namn A-Ö</option>
              <option value="name_desc">Namn Ö-A</option>
              <option value="created_desc">Senast skapade</option>
              <option value="created_asc">Äldst skapade</option>
            </select>
          </div>
        </div>
        {message && <p className="mb-4 text-green-700">{message}</p>}

        {loading ? (
          <p>Laddar personal...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : employees.length === 0 ? (
          <p className="text-gray-500">Ingen personal hittades.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Namn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-post</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skapad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/employee/${employee.id}`}
                        className="font-medium underline"
                        style={{ color: '#2D5016' }}
                      >
                        {employee.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/employee/${employee.id}`}
                        className="underline"
                        style={{ color: '#2D5016' }}
                      >
                        {employee.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {employee.role === 'PAYROLL_COORDINATOR' ? 'Admin' : 'Personal'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{employee.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(employee.createdAt).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => resendSetupEmail(employee.id)}
                          disabled={resendingSetupUserId === employee.id || removingEmployeeId !== null}
                          className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-left"
                        >
                          {resendingSetupUserId === employee.id ? 'Skickar...' : 'Skicka om aktiveringsmejl'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmployeePendingRemove(employee)}
                          disabled={removingEmployeeId !== null}
                          className="px-3 py-1 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-left"
                        >
                          Ta bort
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-8 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold" style={{ color: '#2D5016' }}>
              Semesterplanering ({vacationYear})
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">År:</span>
              <input
                type="number"
                min={new Date().getFullYear() - 1}
                max={new Date().getFullYear() + 20}
                value={vacationYear}
                onChange={(e) => setVacationYear(Number(e.target.value) || new Date().getFullYear())}
                className="px-3 py-2 border border-gray-300 rounded-md w-28"
              />
            </div>
          </div>

          {loadingVacation ? (
            <p className="text-gray-500">Laddar semesterplanering...</p>
          ) : employees.length === 0 ? (
            <p className="text-gray-500">Ingen personal hittades ännu.</p>
          ) : (
            <div className="space-y-4">
              {employees.map((employee) => {
                const selectedWeeks = vacationByEmployee[employee.id] || []
                return (
                  <div key={employee.id} className="border border-gray-300 rounded-md p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-500">{employee.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveVacationWeeks(employee.id)}
                          disabled={savingVacationUserId === employee.id}
                          className="px-4 py-2 rounded-md text-white bg-green-700 hover:bg-green-800 disabled:opacity-50"
                        >
                          {savingVacationUserId === employee.id ? 'Sparar...' : 'Spara semester'}
                        </button>
                        {savedVacationByEmployee[employee.id] && (
                          <span className="text-green-700 text-lg font-bold" title="Sparat">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="flex flex-wrap gap-2 min-w-[760px]">
                        {Array.from({ length: 53 }, (_, index) => index + 1).map((week) => (
                          <button
                            key={week}
                            type="button"
                            onClick={() => toggleVacationWeek(employee.id, week)}
                            className={`px-2 py-2 rounded-md border text-xs font-medium transition ${
                              selectedWeeks.includes(week)
                                ? 'bg-green-700 text-white border-green-700'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50'
                            }`}
                            title={`Vecka ${week}`}
                          >
                            V{week}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="pt-4 border-t border-gray-300 flex justify-end">
                <button
                  type="button"
                  onClick={resetVacationWeeks}
                  disabled={resettingVacation}
                  className="px-5 py-3 rounded-md border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 font-semibold"
                >
                  {resettingVacation ? 'Nollställer...' : 'Nollställ semester'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {employeePendingRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!removingEmployeeId) setEmployeePendingRemove(null)
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Ta bort personal?</h3>
            <p className="mt-3 text-gray-700 text-sm">
              {employeePendingRemove.name} ({employeePendingRemove.email}) tas bort som aktiv anställd.
              Tidigare tidrapporter finns kvar för företaget, men hen kan inte logga in med det gamla kontot. Samma
              e-post kan användas igen om du skapar ett nytt konto.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                disabled={removingEmployeeId !== null}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setEmployeePendingRemove(null)}
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={removingEmployeeId !== null}
                className="px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                onClick={() => removeEmployeeConfirm()}
              >
                {removingEmployeeId !== null ? 'Tar bort...' : 'Ja, ta bort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
