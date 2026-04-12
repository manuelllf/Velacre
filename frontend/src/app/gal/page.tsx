'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'
import LandingPage from '@/components/LandingPage'

export default function GalPage() {
  const { setLocale } = useLanguage()
  useEffect(() => { setLocale('gal') }, [setLocale])
  return <LandingPage />
}
