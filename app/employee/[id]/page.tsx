'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

export default function EmployeePage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params?.id as string
  const [user, setUser] = useState<any>(null)
  const [employee, setEmployee] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [nextOfKin, setNextOfKin] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [showNextOfKinForm, setShowNextOfKinForm] = useState(false)
  const [editingNextOfKin, setEditingNextOfKin] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    type: 'DRIVERS_LICENSE',
    title: '',
    expiryDate: '',
    issuedDate: '',
    description: '',
    file: null as File | null,
    useCamera: false,
  })
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
      
      const [employeeRes, documentsRes, nextOfKinRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/documents?userId=${employeeId}`, {
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

      if (documentsRes.ok) {
        const documentsData = await documentsRes.json()
        setDocuments(documentsData)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.file) {
      setError('Välj en fil att ladda upp')
      return
    }

    setUploading(true)

    try {
      const token = localStorage.getItem('token')
      const formDataToSend = new FormData()
      formDataToSend.append('file', formData.file)
      formDataToSend.append('type', formData.type)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('userId', employeeId)
      if (formData.expiryDate) formDataToSend.append('expiryDate', formData.expiryDate)
      if (formData.issuedDate) formDataToSend.append('issuedDate', formData.issuedDate)
      if (formData.description) formDataToSend.append('description', formData.description)

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ladda upp dokument')
      }

      setSuccess('Dokument uppladdat!')
      setShowUploadForm(false)
      setFormData({
        type: 'DRIVERS_LICENSE',
        title: '',
        expiryDate: '',
        issuedDate: '',
        description: '',
        file: null,
        useCamera: false,
      })
      fetchEmployeeData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta dokument?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Kunde inte ta bort dokument')
      }

      setSuccess('Dokument borttaget!')
      fetchEmployeeData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'DRIVERS_LICENSE': return 'Körkort'
      case 'CERTIFICATION': return 'Certifiering'
      case 'EDUCATION': return 'Utbildningsbevis'
      case 'EMPLOYMENT_CONTRACT': return 'Anställningsavtal'
      default: return type
    }
  }

  const getDocumentsByType = (type: string) => {
    return documents.filter(doc => doc.type === type)
  }

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

  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Vi kommer att använda en enklare lösning med file input och accept="camera"
      // eftersom direkt kamera-API är mer komplext
      setFormData({ ...formData, useCamera: true })
    } catch (err) {
      setError('Kunde inte komma åt kameran. Kontrollera att du har gett behörighet.')
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

      {showUploadForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Ladda upp dokument</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dokumenttyp
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="DRIVERS_LICENSE">Körkort</option>
                <option value="CERTIFICATION">Certifiering</option>
                <option value="EDUCATION">Utbildningsbevis</option>
                <option value="EMPLOYMENT_CONTRACT">Anställningsavtal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titel
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="T.ex. Körkort B, Säkerhetsutbildning"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Utfärdandedatum (valfritt)
                </label>
                <input
                  type="date"
                  value={formData.issuedDate}
                  onChange={(e) => setFormData({ ...formData, issuedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Förfallodatum (valfritt)
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beskrivning (valfritt)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ytterligare information om dokumentet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fil eller foto
              </label>
              <div className="space-y-2">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  required={!formData.useCamera}
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useCamera"
                    checked={formData.useCamera}
                    onChange={(e) => setFormData({ ...formData, useCamera: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="useCamera" className="text-sm text-gray-700">
                    Ta foto med kameran (för körkort och certifikat)
                  </label>
                </div>
                {formData.useCamera && (
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tillåtna format: PDF, JPG, PNG, DOC, DOCX. Du kan ta en bild med kameran för körkort och certifikat.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={uploading}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {uploading ? 'Laddar upp...' : 'Ladda upp'}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Avbryt
              </button>
            </div>
          </form>
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

      {/* Anställningsavtal */}
      {(() => {
        const employmentContracts = getDocumentsByType('EMPLOYMENT_CONTRACT')
        return (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Anställningsavtal</h2>
              {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
                <button
                  onClick={() => {
                    setFormData({
                      type: 'EMPLOYMENT_CONTRACT',
                      title: '',
                      expiryDate: '',
                      issuedDate: '',
                      description: '',
                      file: null,
                      useCamera: false,
                    })
                    setShowUploadForm(true)
                  }}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  + Lägg till anställningsavtal
                </button>
              )}
            </div>
            {employmentContracts.length === 0 ? (
              <p className="text-gray-500 italic">Inget anställningsavtal uppladdat ännu</p>
            ) : (
              <div className="space-y-3">
                {employmentContracts.map((doc) => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Fil: {doc.fileName} ({(doc.fileSize / 1024).toFixed(1)} KB)
                      </p>
                      {doc.issuedDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Utfärdat: {format(new Date(doc.issuedDate), 'd MMMM yyyy', { locale: sv })}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={async () => {
                          const token = localStorage.getItem('token')
                          const response = await fetch(`/api/documents/${doc.id}/download`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                          })
                          if (response.ok) {
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = doc.fileName
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                            document.body.removeChild(a)
                          }
                        }}
                        className="bg-primary-600 text-white px-3 py-2 rounded-md hover:bg-primary-700 text-sm"
                      >
                        Öppna
                      </button>
                      {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                        >
                          Ta bort
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

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

      <div className="space-y-6">
        {(['DRIVERS_LICENSE', 'CERTIFICATION', 'EDUCATION'] as const).map((type) => {
          const typeDocuments = getDocumentsByType(type)
          const addLabelByType: Record<(typeof type), string> = {
            DRIVERS_LICENSE: 'Lägg till körkort',
            CERTIFICATION: 'Lägg till certifiering',
            EDUCATION: 'Lägg till utbildningsbevis',
          }

          return (
            <div key={type} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{getDocumentTypeLabel(type)}</h2>
                {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        type,
                        title: '',
                        expiryDate: '',
                        issuedDate: '',
                        description: '',
                        file: null,
                        useCamera: false,
                      })
                      setShowUploadForm(true)
                    }}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    + {addLabelByType[type]}
                  </button>
                )}
              </div>
              {typeDocuments.length === 0 ? (
                <p className="text-gray-500 italic">Inga dokument ännu</p>
              ) : (
                <div className="space-y-3">
                  {typeDocuments.map((doc) => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{doc.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Fil: {doc.fileName} ({(doc.fileSize / 1024).toFixed(1)} KB)
                        </p>
                        {doc.issuedDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Utfärdat: {format(new Date(doc.issuedDate), 'd MMMM yyyy', { locale: sv })}
                          </p>
                        )}
                        {doc.expiryDate && (
                          <p className={`text-xs mt-1 ${
                            new Date(doc.expiryDate) < new Date() 
                              ? 'text-red-600 font-semibold' 
                              : new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                              ? 'text-orange-600'
                              : 'text-gray-500'
                          }`}>
                            Förfaller: {format(new Date(doc.expiryDate), 'd MMMM yyyy', { locale: sv })}
                            {new Date(doc.expiryDate) < new Date() && ' (FÖRFALLET)'}
                            {new Date(doc.expiryDate) >= new Date() && new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && ' (Förfaller snart)'}
                          </p>
                        )}
                        {doc.description && (
                          <p className="text-sm text-gray-600 mt-2">{doc.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Uppladdat: {format(new Date(doc.createdAt), 'd MMM yyyy', { locale: sv })}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={async () => {
                            const token = localStorage.getItem('token')
                            const response = await fetch(`/api/documents/${doc.id}/download`, {
                              headers: {
                                'Authorization': `Bearer ${token}`,
                              },
                            })
                            if (response.ok) {
                              const blob = await response.blob()
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = doc.fileName
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                            }
                          }}
                          className="bg-primary-600 text-white px-3 py-2 rounded-md hover:bg-primary-700 text-sm"
                        >
                          Öppna
                        </button>
                        {(user?.role === 'ENTREPRENEUR' || user?.role === 'PAYROLL_COORDINATOR' || user?.id === employeeId) && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                          >
                            Ta bort
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
