'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import TimeLapsHeroBrand from '../components/TimeLapsHeroBrand'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [userType, setUserType] = useState<'admin' | 'employee' | null>(null)

  useEffect(() => {
    const savedCredentials = localStorage.getItem('savedLoginCredentials')
    if (savedCredentials) {
      try {
        const parsed = JSON.parse(savedCredentials)
        if (parsed?.email && parsed?.password) {
          setFormData({
            email: parsed.email,
            password: parsed.password,
          })
        }
      } catch (error) {
        console.error('Kunde inte läsa sparade inloggningsuppgifter:', error)
      }
    }

    setKeepLoggedIn(localStorage.getItem('keepLoggedIn') === 'true')

    if (searchParams?.get('registered') === 'true') {
      setSuccess(true)
    }
    const type = searchParams?.get('type')
    if (type === 'admin' || type === 'employee') {
      setUserType(type)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Försöker logga in med:', formData.email)
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          loginType: userType,
          rememberMe: keepLoggedIn,
        }),
      })

      console.log('Svar från server:', response.status, response.statusText)
      
      const data = await response.json()
      console.log('Data från server:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Inloggning misslyckades')
      }

      if (!data.token || !data.user) {
        throw new Error('Ogiltigt svar från servern')
      }

      const isAdminUser = data.user.role === 'ENTREPRENEUR' || data.user.role === 'PAYROLL_COORDINATOR'

      if (userType === 'admin' && !isAdminUser) {
        throw new Error('Detta konto är Personal. Logga in via Personal-rutan istället.')
      }
      if (userType === 'employee' && isAdminUser) {
        throw new Error('Detta konto är Admin. Logga in via Admin-rutan istället.')
      }

      localStorage.setItem('keepLoggedIn', keepLoggedIn ? 'true' : 'false')
      if (keepLoggedIn) {
        localStorage.setItem(
          'savedLoginCredentials',
          JSON.stringify({ email: formData.email, password: formData.password })
        )
      } else {
        localStorage.removeItem('savedLoginCredentials')
        localStorage.removeItem('rememberLoginDecision')
      }

      // Spara token i localStorage
      try {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        console.log('Token och användardata sparade i localStorage')
      } catch (storageError) {
        console.error('Fel vid sparande i localStorage:', storageError)
        throw new Error('Kunde inte spara inloggningsdata. Kontrollera att cookies är aktiverade.')
      }

      // Alla roller (admin + personal) går till överblicken
      const redirectPath = '/dashboard'

      console.log('Omdirigerar till:', redirectPath)
      window.location.href = redirectPath
    } catch (err: any) {
      console.error('Inloggningsfel:', err)
      let errorMessage = 'Ett fel uppstod vid inloggning. Försök igen.'
      
      if (err.message) {
        errorMessage = err.message
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Kunde inte ansluta till servern. Kontrollera att servern körs.'
      } else if (err instanceof SyntaxError) {
        errorMessage = 'Ogiltigt svar från servern. Kontrollera att servern körs korrekt.'
      }
      
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#E8E8D8' }}>
      <div className="absolute top-6 right-4 sm:right-6 z-10">
        <Link
          href="/portal"
          className="text-base md:text-lg font-semibold"
          style={{ color: '#2D5016' }}
        >
          Tillbaka till portalen
        </Link>
      </div>

      <div className="w-full max-w-lg rounded-2xl border border-[#2D5016]/20 bg-white shadow-xl overflow-hidden">
        {/* Logga */}
        <div
          className="px-8 py-10 sm:px-10 sm:py-11 border-b border-[#2D5016]/10"
          style={{
            background: 'linear-gradient(160deg, #F3FAEE 0%, #E8F5DC 55%, #DCECCF 100%)',
          }}
        >
          <TimeLapsHeroBrand embedded showTagline={false} />
        </div>

        {/* Inloggning */}
        <div className="px-8 py-10 sm:px-10 bg-white">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold" style={{ color: '#2D5016' }}>
            {userType === 'admin'
              ? 'Logga in som Admin'
              : userType === 'employee'
              ? 'Logga in som Personal'
              : 'Logga in på ditt konto'}
          </h2>

          <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
            {success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                Registrering lyckades! Du kan nu logga in.
              </div>
            ) : null}
            {error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            ) : null}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder="E-postadress"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Lösenord
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm pr-10"
                    placeholder="Ditt lösenord"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2D5016] focus:ring-[#2D5016]"
              />
              <span className="text-sm text-gray-700 leading-snug">
                Håll mig inloggad i 90 dagar
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-sm font-medium"
                style={{ color: '#2D5016' }}
              >
                Har du glömt lösenordet?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8E8D8' }}>
        <div className="text-center">
          <p style={{ color: '#2D5016' }}>Laddar...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
