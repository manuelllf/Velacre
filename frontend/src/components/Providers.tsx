'use client'

import { LanguageProvider } from '@/lib/i18n'
import PWAInstall from '@/components/PWAInstall'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      {children}
      <PWAInstall />
    </LanguageProvider>
  )
}
