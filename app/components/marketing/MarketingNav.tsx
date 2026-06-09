'use client'

import Link from 'next/link'
import { useState } from 'react'
import TimeLapsLogo from '@/app/components/TimeLapsLogo'

const links = [
  { href: '/funktioner', label: 'Funktioner' },
  { href: '/om-oss', label: 'Om oss' },
  { href: '/sa-funkar-det', label: 'Så funkar det' },
  { href: '/varfor-oss', label: 'Varför välja oss' },
  { href: '/kontakt', label: 'Kontakt' },
]

export default function MarketingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[#2D5016]/10 bg-[#F8FBF5]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <TimeLapsLogo variant="corner" showWordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#2D5016] hover:bg-[#2D5016]/5"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/portal"
            className="ml-2 rounded-lg bg-[#2D5016] px-4 py-2 text-sm font-semibold text-white hover:bg-[#234012]"
          >
            Logga in
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden rounded-lg border border-[#2D5016]/20 px-3 py-2 text-sm font-medium text-[#2D5016]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Meny
        </button>
      </div>

      {open ? (
        <div className="border-t border-[#2D5016]/10 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#2D5016]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/portal"
              className="mt-2 rounded-lg bg-[#2D5016] px-4 py-2 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Logga in
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}
