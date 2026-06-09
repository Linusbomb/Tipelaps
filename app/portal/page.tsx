'use client'

import Link from 'next/link'
import LvtechCornerLogo from '@/app/components/LvtechCornerLogo'
import TimeLapsHeroBrand from '@/app/components/TimeLapsHeroBrand'

export default function PortalPage() {
  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#E8E8D8' }}>
      <LvtechCornerLogo />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 md:py-20 lg:px-8">
        <div className="mb-6 pt-14 text-center sm:pt-12">
          <Link
            href="/"
            className="text-sm font-medium text-[#2D5016]/70 hover:text-[#2D5016] hover:underline"
          >
            ← Tillbaka till hemsidan
          </Link>
        </div>

        <div className="mb-10 text-center sm:mb-14">
          <TimeLapsHeroBrand className="-mt-2" />
          <p className="mx-auto mt-4 max-w-lg text-base text-[#2D5016]/85 sm:text-lg">
            Logga in som admin eller personal i er TimeLaps-portal.
          </p>
        </div>

        <div className="mx-auto mb-12 max-w-4xl sm:mb-16">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            <Link
              href="/login?type=admin"
              className="group relative overflow-hidden rounded-2xl bg-marble-beige p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8"
              style={{ border: '2px solid rgba(45, 80, 22, 0.2)' }}
            >
              <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-600 opacity-20 transition-opacity group-hover:opacity-30" />
              <div className="relative">
                <div className="mb-4 text-5xl transition-transform duration-300 group-hover:scale-110 sm:mb-6 sm:text-6xl">
                  👔
                </div>
                <h3 className="mb-2 text-xl font-bold sm:mb-3 sm:text-2xl" style={{ color: '#2D5016' }}>
                  Admin
                </h3>
                <p
                  className="mb-3 text-sm leading-relaxed sm:mb-4 sm:text-base"
                  style={{ color: '#2D5016' }}
                >
                  Hantera personal, granska tidrapporter och godkänn månadsinlämningar.
                </p>
                <div
                  className="flex items-center text-sm font-semibold transition-transform group-hover:translate-x-2 sm:text-base"
                  style={{ color: '#2D5016' }}
                >
                  Logga in som admin
                  <span className="ml-2">→</span>
                </div>
              </div>
            </Link>

            <Link
              href="/login?type=employee"
              className="group relative overflow-hidden rounded-2xl bg-marble-beige p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8"
              style={{ border: '2px solid rgba(45, 80, 22, 0.2)' }}
            >
              <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-600 opacity-20 transition-opacity group-hover:opacity-30" />
              <div className="relative">
                <div className="mb-4 text-5xl transition-transform duration-300 group-hover:scale-110 sm:mb-6 sm:text-6xl">
                  👷
                </div>
                <h3 className="mb-2 text-xl font-bold sm:mb-3 sm:text-2xl" style={{ color: '#2D5016' }}>
                  Personal
                </h3>
                <p
                  className="mb-3 text-sm leading-relaxed sm:mb-4 sm:text-base"
                  style={{ color: '#2D5016' }}
                >
                  Registrera dagliga timmar och skicka in månaden till din chef.
                </p>
                <div
                  className="flex items-center text-sm font-semibold transition-transform group-hover:translate-x-2 sm:text-base"
                  style={{ color: '#2D5016' }}
                >
                  Logga in som personal
                  <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <p className="text-center text-base font-medium sm:text-lg" style={{ color: '#2D5016' }}>
          Inget konto? Kontakta admin på ditt företag eller{' '}
          <Link href="/kontakt" className="underline hover:no-underline">
            kontakta oss
          </Link>{' '}
          om ni är nya kunder.
        </p>
      </div>
    </div>
  )
}
