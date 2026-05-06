'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: '#E8E8D8' }}
    >
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Konton skapas av admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Personal kan inte registrera konto själva.
            <br />Be din admin skapa ditt konto så får du en e-post för att välja lösenord.
            <br /><br />
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Till inloggning
            </Link>
          </p>
        </div>
        <div className="mt-8">
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2 px-4 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Gå till inloggning
          </button>
        </div>
      </div>
    </div>
  )
}
