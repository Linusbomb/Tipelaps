import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-gray-300 bg-white/40 px-4 py-4 text-center text-xs text-gray-600">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
        <span>© {year} TimeLaps</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/integritetspolicy" className="hover:underline">
            Integritetspolicy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/mitt-konto" className="hover:underline">
            Mitt konto / GDPR-export
          </Link>
        </nav>
      </div>
    </footer>
  )
}
