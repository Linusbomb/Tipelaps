'use client'

import Link from 'next/link'
import TimeLapsLogo from '@/app/components/TimeLapsLogo'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[#2D5016]/10 bg-[#1A3310] text-[#E8F5DC]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <TimeLapsLogo variant="corner" showWordmark className="[&_span]:text-[#E8F5DC] [&_span_span]:text-[#C5E89A]" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#C5E89A]/90">
            TimeLaps är tidrapporteringsportalen från LVtech — byggd för entreprenörer och
            team som vill ha ordning på timmar, projekt och personal.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C5E89A]">
            För kunder
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/portal" className="hover:text-white">
                Logga in (app)
              </Link>
            </li>
            <li>
              <Link href="/login?type=admin" className="hover:text-white">
                Admin-inloggning
              </Link>
            </li>
            <li>
              <Link href="/login?type=employee" className="hover:text-white">
                Personal-inloggning
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#C5E89A]">
            Företaget
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/funktioner" className="hover:text-white">
                Funktioner
              </Link>
            </li>
            <li>
              <Link href="/om-oss" className="hover:text-white">
                Om oss
              </Link>
            </li>
            <li>
              <Link href="/sa-funkar-det" className="hover:text-white">
                Så funkar det
              </Link>
            </li>
            <li>
              <Link href="/varfor-oss" className="hover:text-white">
                Varför välja oss
              </Link>
            </li>
            <li>
              <Link href="/kontakt" className="hover:text-white">
                Kontakta oss
              </Link>
            </li>
            <li>
              <Link href="/integritetspolicy" className="hover:text-white">
                Integritetspolicy
              </Link>
            </li>
          </ul>
          <p className="mt-6 text-xs text-[#C5E89A]/70">part of LVtech</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-[#C5E89A]/60">
        © {new Date().getFullYear()} TimeLaps · LVtech
      </div>
    </footer>
  )
}
