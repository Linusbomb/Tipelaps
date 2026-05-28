'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LvtechCornerLogo from '../components/LvtechCornerLogo'
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

      // Fråga endast första gången om inloggningsuppgifter ska sparas
      const rememberDecision = localStorage.getItem('rememberLoginDecision')
      if (!rememberDecision) {
        const shouldSave = window.confirm(
          'Vill du spara e-postadress och lösenord på den här enheten?'
        )
        localStorage.setItem('rememberLoginDecision', shouldSave ? 'accepted' : 'declined')

        if (shouldSave) {
          localStorage.setItem(
            'savedLoginCredentials',
            JSON.stringify({ email: formData.email, password: formData.password })
          )
        } else {
          localStorage.removeItem('savedLoginCredentials')
        }
      } else if (rememberDecision === 'accepted') {
        // Om användaren redan godkänt, uppdatera sparade uppgifter vid lyckad inloggning
        localStorage.setItem(
          'savedLoginCredentials',
          JSON.stringify({ email: formData.email, password: formData.password })
        )
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
      <LvtechCornerLogo href="/" />
      <div className="absolute top-6 right-4 sm:right-6">
        <Link
          href="/"
          className="text-base md:text-lg font-semibold"
          style={{ color: '#2D5016' }}
        >
          Tillbaka till startsidan
        </Link>
      </div>
      <div className="max-w-2xl w-full space-y-10">
        <div>
          <TimeLapsHeroBrand className="mb-8 -mt-4" />
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: '#2D5016' }}>
            {userType === 'admin' ? 'Logga in som Admin' : 
             userType === 'employee' ? 'Logga in som Personal' : 
             'Logga in på ditt konto'}
          </h2>
          {userType && (
            <div className="mt-3 text-center">
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                userType === 'admin' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {userType === 'admin' ? '👔 Admin' : '👷 Övrig personal'}
              </span>
            </div>
          )}
          <p className="mt-4 text-center text-sm" style={{ color: '#2D5016' }}>
            Logga in med din e-postadress och lösenord.
          </p>
        </div>
        <form className="mt-8 space-y-6 max-w-md mx-auto" onSubmit={handleSubmit}>
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Registrering lyckades! Du kan nu logga in.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
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
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
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
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm pr-10"
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

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
              style={{ backgroundColor: '#2D5016' }}
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </div>
          
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
