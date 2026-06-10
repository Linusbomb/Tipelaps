'use client'

import { LanguageProvider } from '@/contexts/LanguageContext'
import { CompanyModulesProvider } from '@/contexts/CompanyModulesContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <CompanyModulesProvider>{children}</CompanyModulesProvider>
    </LanguageProvider>
  )
}
