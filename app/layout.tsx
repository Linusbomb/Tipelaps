import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import Navigation from './components/Navigation'
import ImpersonationBanner from './components/ImpersonationBanner'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TimeLaps - Enkel tidrapportering för entreprenörer',
  description: 'Samla in och hantera personalens tidrapporter enkelt och smidigt',
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
