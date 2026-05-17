import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8E8D8' }}>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#2D5016' }}>Sidan kunde inte hittas</h2>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-md text-white"
          style={{ backgroundColor: '#2D5016' }}
        >
          Gå till startsidan
        </Link>
      </div>
    </div>
  )
}
