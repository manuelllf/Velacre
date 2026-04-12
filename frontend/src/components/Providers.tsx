'use client'

import { LanguageProvider } from '@/lib/i18n'
import PWAInstall from '@/components/PWAInstall'
import LangSwitcher from '@/components/LangSwitcher'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        {children}
        <PWAInstall />
        <LangSwitcher />
      </LanguageProvider>
    </ErrorBoundary>
  )
}
