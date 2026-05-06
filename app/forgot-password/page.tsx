'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka återställningslänk')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#E8E8D8' }}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-4">
            <Link
              href="/login"
              className="text-sm"
              style={{ color: '#2D5016' }}
            >
              ← Tillbaka till inloggning
            </Link>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: '#2D5016' }}>
            Återställ lösenord
          </h2>
          <p className="mt-4 text-center text-sm" style={{ color: '#2D5016' }}>
            Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              <p className="font-semibold mb-1">E-post skickad!</p>
              <p className="text-sm">
                Om en användare med denna e-postadress finns kommer ett e-postmeddelande med instruktioner för att återställa lösenordet att skickas.
              </p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!success && (
            <>
              <div>
                <label htmlFor="email" className="sr-only">
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                  placeholder="E-postadress"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                  style={{ backgroundColor: '#2D5016' }}
                >
                  {loading ? 'Skickar...' : 'Skicka återställningslänk'}
                </button>
              </div>
            </>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium"
              style={{ color: '#2D5016' }}
            >
              Tillbaka till inloggning
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
