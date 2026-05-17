'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="sv">
      <body>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8E8D8' }}>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#2D5016' }}>Ett allvarligt fel uppstod</h2>
            <button
              onClick={() => reset()}
              className="px-4 py-2 rounded-md text-white"
              style={{ backgroundColor: '#2D5016' }}
            >
              Försök igen
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
