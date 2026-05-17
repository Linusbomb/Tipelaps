'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyPages() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [nextOfKin, setNextOfKin] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [showNextOfKinForm, setShowNextOfKinForm] = useState(false)
  const [editingNextOfKin, setEditingNextOfKin] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  })

  const [nextOfKinFormData, setNextOfKinFormData] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data)
        setNextOfKin(data.nextOfKin || [])
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Kunde inte hämta data')
      }
    } catch (err) {
      console.error('Kunde inte hämta data:', err)
      setError('Ett fel uppstod vid hämtning av data')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Profil uppdaterad!')
        setUser(data)
        // Uppdatera localStorage
        const userData = localStorage.getItem('user')
        if (userData) {
          const parsedUser = JSON.parse(userData)
          parsedUser.name = data.name
          parsedUser.email = data.email
          parsedUser.phone = data.phone
          localStorage.setItem('user', JSON.stringify(parsedUser))
        }
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Kunde inte uppdatera profil')
      }
    } catch (err) {
      setError('Ett fel uppstod vid uppdatering')
    }
  }

  const handleProfileImageUpload = async () => {
    if (!profileImageFile) return

    setUploadingProfile(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('profileImage', profileImageFile)

      const response = await fetch(`/api/users/${user.id}/profile-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Profilbild uppladdad!')
        setProfileImageFile(null)
        fetchData()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Kunde inte ladda upp profilbild')
      }
    } catch (err) {
      setError('Ett fel uppstod vid uppladdning')
    } finally {
      setUploadingProfile(false)
    }
  }

  const handleNextOfKinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
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
        body: JSON.stringify({
          ...nextOfKinFormData,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(editingNextOfKin ? 'Närmast anhörig uppdaterad!' : 'Närmast anhörig tillagd!')
        setShowNextOfKinForm(false)
        setEditingNextOfKin(null)
        setNextOfKinFormData({
          name: '',
          relationship: '',
          phone: '',
          email: '',
          address: '',
        })
        fetchData()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Kunde inte spara närmast anhörig')
      }
    } catch (err) {
      setError('Ett fel uppstod')
    }
  }

  const handleEditNextOfKin = (kin: any) => {
    setEditingNextOfKin(kin)
    setNextOfKinFormData({
      name: kin.name || '',
      relationship: kin.relationship || '',
      phone: kin.phone || '',
      email: kin.email || '',
      address: kin.address || '',
    })
    setShowNextOfKinForm(true)
  }

  const handleDeleteNextOfKin = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna närmast anhörig?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/next-of-kin/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        setSuccess('Närmast anhörig borttagen!')
        fetchData()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Kunde inte ta bort närmast anhörig')
      }
    } catch (err) {
      setError('Ett fel uppstod')
    }
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">Laddar...</div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Mina sidor</h1>

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

      {/* Profilbild */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-xl font-semibold mb-4">Profilbild</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {user?.profileImagePath ? (
            <img
              src={`/api/users/${user.id}/profile-image`}
              alt={user.name}
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center font-semibold text-gray-600 text-2xl">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="w-full sm:w-auto">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
              className="mb-2 w-full"
            />
            <button
              onClick={handleProfileImageUpload}
              disabled={!profileImageFile || uploadingProfile}
              className="w-full sm:w-auto bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingProfile ? 'Laddar upp...' : 'Ladda upp profilbild'}
            </button>
          </div>
        </div>
      </div>

      {/* Personuppgifter */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-xl font-semibold mb-4">Personuppgifter</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Namn *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-post *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefonnummer
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Spara ändringar
          </button>
        </form>
      </div>

      {/* Närmast anhörig */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Närmast anhörig</h2>
          <button
            type="button"
            onClick={() => {
              setShowNextOfKinForm(true)
              setEditingNextOfKin(null)
              setNextOfKinFormData({
                name: '',
                relationship: '',
                phone: '',
                email: '',
                address: '',
              })
            }}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            + Lägg till närmast anhörig
          </button>
        </div>

        {showNextOfKinForm && (
          <form onSubmit={handleNextOfKinSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Namn *
                </label>
                <input
                  type="text"
                  required
                  value={nextOfKinFormData.name}
                  onChange={(e) => setNextOfKinFormData({ ...nextOfKinFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relation *
                </label>
                <input
                  type="text"
                  required
                  value={nextOfKinFormData.relationship}
                  onChange={(e) => setNextOfKinFormData({ ...nextOfKinFormData, relationship: e.target.value })}
                  placeholder="T.ex. Make, Fru, Barn"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefonnummer
                </label>
                <input
                  type="tel"
                  value={nextOfKinFormData.phone}
                  onChange={(e) => setNextOfKinFormData({ ...nextOfKinFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  type="email"
                  value={nextOfKinFormData.email}
                  onChange={(e) => setNextOfKinFormData({ ...nextOfKinFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adress
                </label>
                <input
                  type="text"
                  value={nextOfKinFormData.address}
                  onChange={(e) => setNextOfKinFormData({ ...nextOfKinFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="submit"
                className="w-full sm:w-auto bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
              >
                {editingNextOfKin ? 'Uppdatera' : 'Lägg till'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNextOfKinForm(false)
                  setEditingNextOfKin(null)
                }}
                className="w-full sm:w-auto bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Avbryt
              </button>
            </div>
          </form>
        )}

        {nextOfKin.length === 0 ? (
          <p className="text-gray-500">Ingen närmast anhörig registrerad ännu.</p>
        ) : (
          <div className="space-y-4">
            {nextOfKin.map((kin) => (
              <div key={kin.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{kin.name}</h3>
                    <p className="text-sm text-gray-600">Relation: {kin.relationship}</p>
                    {kin.phone && <p className="text-sm text-gray-600">Telefon: {kin.phone}</p>}
                    {kin.email && <p className="text-sm text-gray-600">E-post: {kin.email}</p>}
                    {kin.address && <p className="text-sm text-gray-600">Adress: {kin.address}</p>}
                  </div>
                  <div className="flex gap-3 sm:gap-2">
                    <button
                      onClick={() => handleEditNextOfKin(kin)}
                      className="text-primary-600 hover:text-primary-900 text-sm"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={() => handleDeleteNextOfKin(kin.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
