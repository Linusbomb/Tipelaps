'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Language, translations } from '@/lib/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('sv')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Ladda språk från localStorage vid mount
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('language') as Language
      if (savedLanguage && ['sv', 'en', 'da', 'fi', 'no'].includes(savedLanguage)) {
        setLanguageState(savedLanguage)
      } else {
        // Om inget språk finns, sätt default till svenska
        localStorage.setItem('language', 'sv')
      }
    }
  }, [])

  const setLanguage = (lang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
      // Uppdatera state direkt
      setLanguageState(lang)
      // Ladda om sidan för att applicera översättningar överallt
      setTimeout(() => {
        window.location.reload()
      }, 100)
    }
  }

  const t = (key: string): string => {
    if (!mounted) return key
    return translations[language]?.[key] || translations['sv']?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
