'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Home() {
  const { t } = useLanguage()
  
  return (
    <div style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 md:py-20">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center mb-5">
            <Image
              src="/lvtech-logo.png"
              alt="LVtech"
              width={260}
              height={260}
              className="h-28 sm:h-32 md:h-40 w-auto"
              priority
            />
          </div>
          <p
            className="mt-4 sm:mt-6 max-w-2xl mx-auto text-xl sm:text-2xl md:text-3xl leading-relaxed font-medium tracking-wide px-2"
            style={{
              color: '#2D5016',
              fontFamily: '"Avenir Next", "Montserrat", "Segoe UI", sans-serif',
              letterSpacing: '0.02em',
            }}
          >
            Tidrapportering ska vara enkelt
          </p>
        </div>

        {/* Login Cards */}
        <div className="max-w-4xl mx-auto mb-12 sm:mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Link
              href="/login?type=admin"
              className="group relative overflow-hidden rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-marble-beige"
              style={{ 
                border: '2px solid rgba(45, 80, 22, 0.2)',
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">👔</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Admin</h3>
                <p className="mb-3 sm:mb-4 leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                  Hantera personal, granska tidrapporter och godkänn månadsinlämningar.
                </p>
                <div className="flex items-center font-semibold text-sm sm:text-base group-hover:translate-x-2 transition-transform" style={{ color: '#2D5016' }}>
                  Logga in som admin
                  <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
            
            <Link
              href="/login?type=employee"
              className="group relative overflow-hidden rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-marble-beige"
              style={{ 
                border: '2px solid rgba(45, 80, 22, 0.2)',
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600 rounded-full -mr-16 -mt-16 opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">👷</div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Personal</h3>
                <p className="mb-3 sm:mb-4 leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                  Registrera dagliga timmar och skicka in månaden till din chef.
                </p>
                <div className="flex items-center font-semibold text-sm sm:text-base group-hover:translate-x-2 transition-transform" style={{ color: '#2D5016' }}>
                  Logga in som personal
                  <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Register CTA */}
        <div className="text-center mb-14 sm:mb-20">
          <p className="mb-4 sm:mb-6 text-base sm:text-lg" style={{ color: '#2D5016' }}>
            Har du inget konto?
          </p>
          <Link
            href="/register"
            className="inline-block text-white px-7 sm:px-10 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: '#2D5016' }}
          >
            Skapa nytt konto
          </Link>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12" style={{ color: '#2D5016' }}>
            Varför välja oss?
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">⏱️</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Daglig tidrapportering</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Fyll i arbetstid enkelt varje dag direkt i systemet.
              </p>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">📊</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Månadsöversikt</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Se en tydlig sammanställning av timmar per månad.
              </p>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">🔒</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Säker inloggning</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Logga in med e-post och personligt lösenord.
              </p>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">📤</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Skicka till chef</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Skicka in månadens rapport med ett klick vid månadsskifte.
              </p>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">📁</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Adminhantering</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Admin kan hantera personal, kategorier och inkomna rapporter.
              </p>
            </div>
            <div className="p-6 sm:p-8 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-marble-beige" style={{ border: '1px solid rgba(45, 80, 22, 0.2)' }}>
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">✅</div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: '#2D5016' }}>Enkelt och snabbt</h3>
              <p className="leading-relaxed text-sm sm:text-base" style={{ color: '#2D5016' }}>
                Byggt för att vara lätt att använda för både admin och personal.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
