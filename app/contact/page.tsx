'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContactPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    // Endast för övrig personal (EMPLOYEE)
    if (parsedUser.role !== 'EMPLOYEE') {
      router.push('/admin')
      return
    }

    setUser(parsedUser)
    fetchEmployees()
  }, [router])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/employees/contact', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      } else {
        const data = await response.json()
        setError(data.error || 'Kunde inte hämta kontakter')
      }
    } catch (err) {
      console.error('Kunde inte hämta kontakter:', err)
      setError('Ett fel uppstod vid hämtning av kontakter')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div className="p-8">Laddar...</div>
  }

  return (
    <div className="app-shell-wide">
      <div className="mb-8">
        <h1 className="app-title text-gray-900 mb-2">Kontakt - Hjälp och support</h1>
        <p className="text-gray-600">
          Här kan du se vem du kan kontakta om du behöver hjälp eller har frågor.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        {loading ? (
          <div className="text-center py-8">Laddar...</div>
        ) : employees.length === 0 ? (
          <p className="text-gray-500">Ingen personal registrerad ännu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Namn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefonnummer
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => {
                  const isAdmin = employee.role === 'ENTREPRENEUR' || employee.role === 'PAYROLL_COORDINATOR'
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {employee.profileImagePath ? (
                            <img
                              src={`/api/users/${employee.id}/profile-image`}
                              alt={employee.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-semibold text-gray-600 mr-3">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            {isAdmin && (
                              <div className="text-xs text-gray-500">Chef / Lönesamordnare</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {employee.phone ? (
                            <a href={`tel:${employee.phone}`} className="text-primary-600 hover:text-primary-900">
                              {employee.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Ej angivet</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
