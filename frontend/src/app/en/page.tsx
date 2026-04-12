'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n'
import LandingPage from '@/components/LandingPage'

export default function EnPage() {
  const { setLocale } = useLanguage()
  useEffect(() => { setLocale('en') }, [setLocale])
  return <LandingPage />
}
