'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'
import LandingPage from '@/components/LandingPage'

export default function EsPage() {
  const { setLocale } = useLanguage()
  useEffect(() => { setLocale('es') }, [setLocale])
  return <LandingPage />
}
