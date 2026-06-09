import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navigation from './components/Navigation'
import ImpersonationBanner from './components/ImpersonationBanner'
import SuperAdminPublicRedirect from './components/SuperAdminPublicRedirect'
import SuperAdminAppRedirect from './components/SuperAdminAppRedirect'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TimeLaps — Tidrapportering för entreprenörer | LVtech',
  description:
    'TimeLaps samlar tidrapportering, projekt och personal i en portal. Kontakta LVtech för demo — befintliga kunder loggar in via appen.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body className={inter.className}>
        <Providers>
          <SuperAdminPublicRedirect />
          <SuperAdminAppRedirect />
          <ImpersonationBanner />
          <Navigation />
          <main className="min-h-screen" style={{ backgroundColor: '#E8E8D8' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
