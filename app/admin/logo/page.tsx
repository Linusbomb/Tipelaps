'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoUploadPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'ENTREPRENEUR' && parsedUser.role !== 'PAYROLL_COORDINATOR') {
      router.push('/admin')
      return
    }

    setUser(parsedUser)
    fetchLogo()
  }, [router])

  const fetchLogo = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/company/logo', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setLogoPath(data.logoPath)
      }
    } catch (err) {
      console.error('Kunde inte hämta logga:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setSuccess('')
    setUploading(true)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('logo', file)

      const response = await fetch('/api/company/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte ladda upp logga')
      }

      setSuccess('Logga uppladdad!')
      setLogoPath(data.logoPath)
      // Uppdatera sidan efter 1 sekund för att visa ny logga
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user || loading) {
    return <div className="p-8">Laddar...</div>
  }

  return (
    <div className="app-shell-narrow">
      <div className="flex justify-between items-center mb-8">
        <h1 className="app-title text-gray-900">Hantera företagslogga</h1>
        <div className="flex items-center space-x-4">
          <a
            href="/admin"
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            ← Tillbaka till admin
          </a>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logga ut
          </button>
        </div>
      </div>

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

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Nuvarande logga</h2>
        {logoPath ? (
          <div className="mb-6">
            <img
              src={`/api/company/logo/${encodeURIComponent(logoPath)}`}
              alt="Företagslogga"
              className="max-h-32 max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-gray-500 mb-6">Ingen logga uppladdad ännu</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ladda upp ny logga
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-2">
            Tillåtna format: PNG, JPG, GIF, SVG. Max storlek: 5MB
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Tips:</strong> Din logga kommer att visas på höger sida i navigationen på alla sidor för ditt företag.
        </p>
      </div>
    </div>
  )
}
