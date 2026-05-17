'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Language, languageNames, languageFlags } from '@/lib/translations'

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const languages: Language[] = ['sv', 'en', 'da', 'fi', 'no']

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLanguageChange = (lang: Language) => {
    setIsOpen(false)
    if (typeof window !== 'undefined') {
      // Spara språkvalet direkt i localStorage
      localStorage.setItem('language', lang)
      // Anropa setLanguage som kommer att ladda om sidan
      setLanguage(lang)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
        style={{ color: '#2D5016' }}
        aria-label="Välj språk"
      >
        <span className="text-xl">{languageFlags[language]}</span>
        <span className="hidden sm:inline">{languageNames[language]}</span>
        <span className="text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 hover:bg-gray-100 transition-colors ${
                  language === lang ? 'bg-blue-50' : ''
                }`}
                style={{ color: language === lang ? '#2D5016' : '#374151' }}
              >
                <span className="text-xl">{languageFlags[lang]}</span>
                <span>{languageNames[lang]}</span>
                {language === lang && (
                  <span className="ml-auto text-primary-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
