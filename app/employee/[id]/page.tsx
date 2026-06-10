'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import EmployeeDocumentsPanel from '@/app/components/EmployeeDocumentsPanel'
import { useCompanyModules } from '@/contexts/CompanyModulesContext'

export default function EmployeePage() {
  const { hasModule } = useCompanyModules()
  const hasEmployeeDocsModule = hasModule('employee_docs')
  const router = useRouter()
  const params = useParams()
  const employeeId = params?.id as string
  const [user, setUser] = useState<any>(null)
  const [employee, setEmployee] = useState<any>(null)
  const [nextOfKin, setNextOfKin] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNextOfKinForm, setShowNextOfKinForm] = useState(false)
  const [editingNextOfKin, setEditingNextOfKin] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showProfileImageUpload, setShowProfileImageUpload] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [uploadingProfile, setUploadingProfile] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    
    // Kontrollera om användaren har behörighet
    if (parsedUser.role !== 'ENTREPRENEUR' && parsedUser.role !== 'PAYROLL_COORDINATOR' && parsedUser.id !== employeeId) {
      router.push('/time-report')
      return
    }

    fetchEmployeeData()
  }, [router, employeeId])

  const fetchEmployeeData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const [employeeRes, nextOfKinRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/next-of-kin?userId=${employeeId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])

      if (employeeRes.ok) {
        const employeeData = await employeeRes.json()
        setEmployee(employeeData)
      }

      if (nextOfKinRes.ok) {
        const nextOfKinData = await nextOfKinRes.json()
        setNextOfKin(nextOfKinData)
      }
    } catch (err) {
      console.error('Kunde inte hämta data:', err)
    } finally {
      setLoading(false)
    }
  }

  const canManage =
    user?.role === 'ENTREPRENEUR' ||
    user?.role === 'PAYROLL_COORDINATOR' ||
    user?.id === employeeId

  if (loading) {
    return <div className="p-8">Laddar...</div>
  }

  if (!employee) {
    return <div className="p-8">Anställd hittades inte</div>
  }

  const handleProfileImageUpload = async () => {
    if (!profileImageFile) {
      setError('Välj en bild')
      return
    }

    setUploadingProfile(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const formDataToSend = new FormData()
      formDataToSend.append('profileImage', profileImageFile)

      const response = await fetch(`/api/users/${employeeId}/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ladda upp profilbild')
      }

      setSuccess('Profilbild uppladdad!')
      setShowProfileImageUpload(false)
      setProfileImageFile(null)
      fetchEmployeeData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingProfile(false)
    }
  }

  return (
    <div className="app-shell-wide max-w-6xl">
      <div className="flex items-center space-x-4 mb-8">
        <div className="relative">
          {employee.profileImagePath ? (
            <img
              src={`/api/users/${employeeId}/profile-image`}
              alt={employee.name}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-2xl font-semibold text-gray-600">
              {employee.name.charAt(0).toUpperCase()}
            </div>
          )}
          {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
            <button
              onClick={() => setShowProfileImageUpload(!showProfileImageUpload)}
              className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-2 hover:bg-primary-700 text-xs"
              title="Ändra profilbild"
            >
              📷
            </button>
          )}
        </div>
        <div>
            <h1 className="app-title text-gray-900">{employee.name}</h1>
          <p className="text-gray-600 mt-1">{employee.email}</p>
          {employee.phone && (
            <p className="text-gray-600 mt-1">📞 {employee.phone}</p>
          )}
        </div>
      </div>

      {showProfileImageUpload && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Ladda upp profilbild</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Välj bild
              </label>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setProfileImageFile(e.target.files[0])
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Du kan ta en bild med kameran eller välja en befintlig bild
              </p>
            </div>
            {profileImageFile && (
              <div className="mt-4">
                <img
                  src={URL.createObjectURL(profileImageFile)}
                  alt="Förhandsvisning"
                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                />
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={handleProfileImageUpload}
                disabled={uploadingProfile || !profileImageFile}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {uploadingProfile ? 'Laddar upp...' : 'Ladda upp'}
              </button>
              <button
                onClick={() => {
                  setShowProfileImageUpload(false)
                  setProfileImageFile(null)
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Personuppgifter */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Personuppgifter</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Namn</p>
            <p className="font-medium text-gray-900">{employee.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">E-post</p>
            <p className="font-medium text-gray-900">{employee.email}</p>
          </div>
          {employee.phone && (
            <div>
              <p className="text-sm text-gray-500">Telefonnummer</p>
              <p className="font-medium text-gray-900">{employee.phone}</p>
            </div>
          )}
        </div>
      </div>

      {hasEmployeeDocsModule ? (
      <div className="mb-6">
        <EmployeeDocumentsPanel
          userId={employeeId}
          canManage={canManage}
          title="Dokument"
          description="ID06, körkort, certifikat, anställningsavtal och andra dokument."
          onNotify={({ type, text }) => {
            if (type === 'success') {
              setSuccess(text)
              setError('')
            } else {
              setError(text)
              setSuccess('')
            }
          }}
        />
      </div>
      ) : null}

      {/* Närmsta anhöriga */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Närmsta anhöriga</h2>
          {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
            <button
              type="button"
              onClick={() => {
                setEditingNextOfKin(null)
                setShowNextOfKinForm(true)
              }}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              + Lägg till närmsta anhörig
            </button>
          )}
        </div>
        {nextOfKin.length === 0 ? (
          <p className="text-gray-500 italic">Inga närmsta anhöriga registrerade ännu</p>
        ) : (
          <div className="space-y-3">
            {nextOfKin.map((kin) => (
              <div key={kin.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{kin.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">Relation: {kin.relationship}</p>
                    {kin.phone && (
                      <p className="text-sm text-gray-600 mt-1">📞 {kin.phone}</p>
                    )}
                    {kin.email && (
                      <p className="text-sm text-gray-600 mt-1">✉️ {kin.email}</p>
                    )}
                    {kin.address && (
                      <p className="text-sm text-gray-600 mt-1">📍 {kin.address}</p>
                    )}
                  </div>
                  {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingNextOfKin(kin)
                          setShowNextOfKinForm(true)
                        }}
                        className="bg-primary-600 text-white px-3 py-2 rounded-md hover:bg-primary-700 text-sm"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Är du säker på att du vill ta bort denna närmsta anhörig?')) return
                          try {
                            const token = localStorage.getItem('token')
                            const response = await fetch(`/api/next-of-kin/${kin.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` },
                            })
                            if (response.ok) {
                              setSuccess('Närmsta anhörig borttagen')
                              fetchEmployeeData()
                            } else {
                              const data = await response.json()
                              setError(data.error || 'Kunde inte ta bort')
                            }
                          } catch (err: any) {
                            setError(err.message)
                          }
                        }}
                        className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                      >
                        Ta bort
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulär för närmsta anhörig */}
      {showNextOfKinForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingNextOfKin ? 'Redigera närmsta anhörig' : 'Lägg till närmsta anhörig'}
          </h2>
          <form onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            setSuccess('')
            try {
              const token = localStorage.getItem('token')
              const formData = new FormData(e.currentTarget)
              const data = {
                userId: employeeId,
                name: formData.get('name'),
                relationship: formData.get('relationship'),
                phone: formData.get('phone') || null,
                email: formData.get('email') || null,
                address: formData.get('address') || null,
              }
              const url = editingNextOfKin 
                ? `/api/next-of-kin/${editingNextOfKin.id}`
                : '/api/next-of-kin'
              const method = editingNextOfKin ? 'PUT' : 'POST'
              const response = await fetch(url, {
                method,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(data),
              })
              const result = await response.json()
              if (response.ok) {
                setSuccess(editingNextOfKin ? 'Närmsta anhörig uppdaterad!' : 'Närmsta anhörig tillagd!')
                setShowNextOfKinForm(false)
                setEditingNextOfKin(null)
                fetchEmployeeData()
              } else {
                setError(result.error || 'Kunde inte spara')
              }
            } catch (err: any) {
              setError(err.message)
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Namn *
              </label>
              <input
                type="text"
                name="name"
                defaultValue={editingNextOfKin?.name || ''}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relation *
              </label>
              <select
                name="relationship"
                defaultValue={editingNextOfKin?.relationship || ''}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Välj relation</option>
                <option value="Make">Make</option>
                <option value="Fru">Fru</option>
                <option value="Sambo">Sambo</option>
                <option value="Barn">Barn</option>
                <option value="Förälder">Förälder</option>
                <option value="Syskon">Syskon</option>
                <option value="Annat">Annat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefonnummer
              </label>
              <input
                type="tel"
                name="phone"
                defaultValue={editingNextOfKin?.phone || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-post
              </label>
              <input
                type="email"
                name="email"
                defaultValue={editingNextOfKin?.email || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adress
              </label>
              <textarea
                name="address"
                defaultValue={editingNextOfKin?.address || ''}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                {editingNextOfKin ? 'Uppdatera' : 'Lägg till'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNextOfKinForm(false)
                  setEditingNextOfKin(null)
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
