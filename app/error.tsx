'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-8"
      style={{ backgroundColor: '#E8E8D8' }}
    >
      <h2 className="text-xl font-semibold text-gray-900">Något gick fel</h2>
      <p className="text-sm text-gray-700 text-center max-w-md">{error.message || 'Ett oväntat fel uppstod.'}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-md text-white text-sm font-medium"
        style={{ backgroundColor: '#2D5016' }}
      >
        Försök igen
      </button>
    </div>
  )
}
