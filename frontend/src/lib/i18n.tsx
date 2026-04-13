'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { LandingLocale } from '@/locales/types'
import es from '@/locales/es'
import en from '@/locales/en'
import gal from '@/locales/gal'

type Lang = 'es' | 'en' | 'gal'

const LOCALES: Record<Lang, LandingLocale> = { es, en, gal }
const STORAGE_KEY = 'velacre_lang'

interface LanguageContextValue {
  locale: Lang
  setLocale: (lang: Lang) => void
  t: LandingLocale
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'es',
  setLocale: () => {},
  t: es,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Lang>('es')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (stored && LOCALES[stored]) {
        setLocaleState(stored)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  // Sync <html lang="..."> with current locale
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function setLocale(lang: Lang) {
    setLocaleState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // localStorage not available
    }
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: LOCALES[locale] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
